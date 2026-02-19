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

  console.log('[SuperReddit] Chat API observer loaded (passive observation)');
})();
