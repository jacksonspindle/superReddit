// SuperReddit — Chat API Observer (MAIN world script)
// Passively observes Reddit's own API responses when the user views their chats.
// This script does NOT:
//   - Make any additional API requests
//   - Modify any requests or responses
//   - Store or forward authentication tokens
//   - Bypass any rate limits or access controls
// It only reads data the browser already loads for the logged-in user,
// the same data Reddit's own UI displays.

(function () {
  'use strict';

  const MSG_TYPE = '__SR_CHAT_INTERCEPT__';

  // Only observe responses from Reddit's own chat/messaging infrastructure
  const CHAT_PATTERNS = [
    'gql.reddit.com',
    'gateway.reddit.com',
    'sendbird.reddit.com',
    '/api/v1/sendbird/',
    '/svc/shreddit/',
    '/svc/matrix-web/',
    '/api/chat/',
    '/api/v1/chat/',
  ];

  function isChatRelated(url) {
    if (!url || typeof url !== 'string') return false;
    return CHAT_PATTERNS.some(function (p) { return url.indexOf(p) !== -1; });
  }

  // --- Observe fetch responses ---
  var originalFetch = window.fetch;
  window.fetch = function () {
    var args = arguments;
    var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';

    // Capture request body for GraphQL operation names
    var reqBody = null;
    var init = args[1];
    if (init && init.body && typeof init.body === 'string') {
      try { reqBody = JSON.parse(init.body); } catch (e) { /* not JSON */ }
    }

    return originalFetch.apply(this, args).then(function (response) {
      try {
        if (isChatRelated(url)) {
          var opName = (reqBody && reqBody.operationName) || null;
          console.log('[SuperReddit] Fetch intercept: ' + url.substring(0, 120) + ' [' + response.status + ']' + (opName ? ' op=' + opName : ''));
          var clone = response.clone();
          clone.text().then(function (text) {
            // Try JSON parse
            try {
              var data = JSON.parse(text);
              var keys = Object.keys(data).join(',');
              // For GraphQL, also log the inner data keys + a preview
              var extraInfo = '';
              if (data.data && typeof data.data === 'object') {
                extraInfo = ' dataKeys=' + Object.keys(data.data).join(',');
              }
              console.log('[SuperReddit] Fetch JSON: ' + url.substring(0, 80) + ' keys=' + keys + extraInfo + (opName ? ' op=' + opName : ''));
              window.postMessage({
                type: MSG_TYPE,
                url: url,
                data: data,
                operationName: opName,
                ts: Date.now(),
              }, '*');
            } catch (e) {
              // Not JSON — log first 200 chars for debugging
              if (text.length > 0) {
                console.log('[SuperReddit] Fetch non-JSON: ' + url.substring(0, 80) + ' body=' + text.substring(0, 200));
              }
            }
          }).catch(function () { /* read error — ignore */ });
        }
      } catch (e) { /* never break the page */ }
      return response;
    });
  };

  // --- Observe XMLHttpRequest responses ---
  var xhrOpen = XMLHttpRequest.prototype.open;
  var xhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._srUrl = typeof url === 'string' ? url : '';
    return xhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    var self = this;
    if (isChatRelated(self._srUrl)) {
      self.addEventListener('load', function () {
        try {
          var data = JSON.parse(self.responseText);
          window.postMessage({
            type: MSG_TYPE,
            url: self._srUrl,
            data: data,
            operationName: null,
            ts: Date.now(),
          }, '*');
        } catch (e) { /* not JSON — ignore */ }
      });
    }
    return xhrSend.apply(this, arguments);
  };

  // --- Observe WebSocket messages ---
  var OriginalWebSocket = window.WebSocket;

  // Track WS frame types for diagnostics (only log first few of each type)
  var wsFrameLog = {};
  var wsFrameCount = 0;

  function extractMessageFromObj(obj) {
    if (!obj || typeof obj !== 'object') return null;
    // Text — try many field names
    var text = obj.message || obj.text || obj.body || '';
    if (obj.content && typeof obj.content === 'object') {
      text = text || obj.content.body || obj.content.text || obj.content.message || '';
    }
    if (typeof text !== 'string' || text.length === 0) return null;

    // Author — try many patterns
    var author = null;
    if (obj.user && typeof obj.user === 'object') {
      author = obj.user.nickname || obj.user.user_id || obj.user.name || obj.user.username || null;
    }
    if (!author && obj.sender && typeof obj.sender === 'object') {
      author = obj.sender.nickname || obj.sender.user_id || obj.sender.name || obj.sender.username || null;
    }
    if (!author && obj.author && typeof obj.author === 'object') {
      author = obj.author.name || obj.author.username || obj.author.nickname || null;
    }
    if (!author) author = obj.user_id || obj.sender_id || obj.authorId || obj.senderId || null;
    // Matrix format: sender is a string like "@user:reddit.com"
    if (!author && typeof obj.sender === 'string') {
      author = obj.sender.replace(/^@/, '').replace(/:.*$/, '');
    }
    if (!author) return null;

    var ts = obj.created_at || obj.createdAt || obj.timestamp || obj.ts ||
             obj.origin_server_ts || obj.sentAt || 0;
    var id = obj.message_id || obj.msg_id || obj.reqId || obj.event_id || obj.id || '';

    return {
      id: 'ws_' + (id || Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
      text: text,
      author: String(author).toLowerCase(),
      timestamp: typeof ts === 'number' ? ts : (new Date(ts).getTime() || Date.now()),
      message_id: obj.message_id || obj.msg_id || obj.event_id || null,
    };
  }

  function parseWSFrame(raw) {
    if (typeof raw !== 'string' || raw.length < 5) return null;

    var messages = [];
    var channelUrl = null;

    try {
      // Format A: SendBird "MESG{json}" — 4-char command prefix + JSON
      if (raw.substring(0, 4) === 'MESG') {
        var jsonStart = raw.indexOf('{');
        if (jsonStart !== -1) {
          var parsed = JSON.parse(raw.substring(jsonStart));
          channelUrl = parsed.channel_url || null;
          var msg = extractMessageFromObj(parsed);
          if (msg) messages.push(msg);
        }
      }
      // Format B: Any other SendBird command with JSON (e.g., LOGI, READ, DLVR)
      else if (/^[A-Z]{4}/.test(raw)) {
        var jStart = raw.indexOf('{');
        if (jStart !== -1) {
          var pdata = JSON.parse(raw.substring(jStart));
          channelUrl = pdata.channel_url || null;
          // Only extract messages from MESG-like commands
          if (raw.substring(0, 4) === 'MESG') {
            var m2 = extractMessageFromObj(pdata);
            if (m2) messages.push(m2);
          }
        }
      }
      // Format C: Pure JSON
      else if (raw.charAt(0) === '{' || raw.charAt(0) === '[') {
        var data = JSON.parse(raw);

        if (data && typeof data === 'object' && !Array.isArray(data)) {
          var msgType = data.type || data.command || '';

          // SendBird: type/command contains "MESG"
          if (typeof msgType === 'string' && msgType.indexOf('MESG') !== -1) {
            channelUrl = data.channel_url || null;
            var payload = data.payload || data;
            var m = extractMessageFromObj(payload);
            if (m) messages.push(m);
          }
          // Matrix: type is "m.room.message"
          else if (msgType === 'm.room.message') {
            channelUrl = data.room_id || null;
            var mm = extractMessageFromObj(data);
            if (mm) messages.push(mm);
          }
          // Generic: has message-like content regardless of type
          else {
            var gm = extractMessageFromObj(data);
            if (gm) messages.push(gm);
          }

          // Check for nested messages array (batch responses)
          var msgsArr = data.messages || data.events || data.chunk || null;
          if (Array.isArray(msgsArr)) {
            for (var k = 0; k < msgsArr.length; k++) {
              channelUrl = channelUrl || msgsArr[k].channel_url || msgsArr[k].room_id || null;
              var bm = extractMessageFromObj(msgsArr[k]);
              if (bm) messages.push(bm);
            }
          }
        }

        // Array of messages (batch delivery)
        if (Array.isArray(data)) {
          for (var i = 0; i < data.length; i++) {
            var item = data[i];
            if (item && typeof item === 'object') {
              channelUrl = channelUrl || item.channel_url || item.room_id || null;
              var im = extractMessageFromObj(item);
              if (im) messages.push(im);
            }
          }
        }
      }
    } catch (e) {
      // Not valid JSON — ignore (many WS frames are binary or control frames)
    }

    if (messages.length === 0) return null;
    return { messages: messages, channelUrl: channelUrl };
  }

  window.WebSocket = function (url, protocols) {
    var ws = protocols !== undefined
      ? new OriginalWebSocket(url, protocols)
      : new OriginalWebSocket(url);

    console.log('[SuperReddit] WebSocket opened: ' + (url || '').substring(0, 100));

    ws.addEventListener('message', function (event) {
      try {
        // Diagnostic: log first 5 frames per WS, then every 50th
        wsFrameCount++;
        if (wsFrameCount <= 5 || wsFrameCount % 50 === 0) {
          var preview = typeof event.data === 'string'
            ? event.data.substring(0, 200)
            : '[binary ' + (event.data && event.data.byteLength ? event.data.byteLength + 'b' : 'data') + ']';
          console.log('[SuperReddit] WS frame #' + wsFrameCount + ': ' + preview);
        }

        var result = parseWSFrame(event.data);
        if (result && result.messages.length > 0) {
          console.log('[SuperReddit] WS parsed ' + result.messages.length + ' messages from frame');
          window.postMessage({
            type: MSG_TYPE,
            url: url || '',
            data: null,
            operationName: null,
            ts: Date.now(),
            websocket: true,
            messages: result.messages,
            channelUrl: result.channelUrl,
          }, '*');
        }
      } catch (e) { /* never break the page */ }
    });

    return ws;
  };

  // Preserve WebSocket prototype and constants
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;

  console.log('[SuperReddit] Chat API observer loaded (passive observation + WebSocket)');
})();
