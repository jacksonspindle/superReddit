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
          var clone = response.clone();
          clone.json().then(function (data) {
            window.postMessage({
              type: MSG_TYPE,
              url: url,
              data: data,
              operationName: (reqBody && reqBody.operationName) || null,
              ts: Date.now(),
            }, '*');
          }).catch(function () { /* not JSON — ignore */ });
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

  // --- Observe WebSocket messages (SendBird chat) ---
  var OriginalWebSocket = window.WebSocket;

  function parseSendBirdFrame(raw) {
    if (typeof raw !== 'string' || raw.length < 5) return null;

    var messages = [];
    var channelUrl = null;

    function extractSBMessage(obj) {
      if (!obj || typeof obj !== 'object') return null;
      // Text
      var text = obj.message || obj.text || obj.body || '';
      if (typeof text !== 'string' || text.length === 0) return null;
      // Author
      var author = null;
      if (obj.user) {
        author = obj.user.nickname || obj.user.user_id || obj.user.name || null;
      }
      if (!author) author = obj.user_id || obj.sender_id || null;
      if (!author) return null;
      return {
        id: 'ws_' + (obj.message_id || obj.msg_id || obj.reqId || Date.now() + '_' + Math.random().toString(36).substr(2, 6)),
        text: text,
        author: String(author).toLowerCase(),
        timestamp: obj.created_at || obj.createdAt || obj.ts || Date.now(),
        message_id: obj.message_id || obj.msg_id || null,
      };
    }

    try {
      // Format A: "MESG{json}" — 4-char command prefix + JSON
      if (raw.substring(0, 4) === 'MESG') {
        var jsonStart = raw.indexOf('{');
        if (jsonStart !== -1) {
          var parsed = JSON.parse(raw.substring(jsonStart));
          channelUrl = parsed.channel_url || null;
          var msg = extractSBMessage(parsed);
          if (msg) messages.push(msg);
        }
      }
      // Format B/C: Pure JSON (might be MESG type or have command field)
      else if (raw.charAt(0) === '{' || raw.charAt(0) === '[') {
        var data = JSON.parse(raw);
        // Single message object
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          var type = data.type || data.command || '';
          if (typeof type === 'string' && type.indexOf('MESG') !== -1) {
            channelUrl = data.channel_url || null;
            var payload = data.payload || data;
            var m = extractSBMessage(payload);
            if (m) messages.push(m);
          }
        }
        // Array of messages (batch delivery)
        if (Array.isArray(data)) {
          for (var i = 0; i < data.length; i++) {
            var item = data[i];
            if (item && item.type === 'MESG') {
              channelUrl = channelUrl || item.channel_url || null;
              var im = extractSBMessage(item);
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

    ws.addEventListener('message', function (event) {
      try {
        var result = parseSendBirdFrame(event.data);
        if (result && result.messages.length > 0) {
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
