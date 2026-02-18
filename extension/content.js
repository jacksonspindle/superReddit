// SuperReddit DM Bridge — Content Script
// Bridges window.postMessage ↔ chrome.runtime.sendMessage

(function () {
  // Announce extension is ready
  window.postMessage(
    { source: 'superreddit-extension', type: 'EXTENSION_READY' },
    '*'
  );

  // Listen for messages from the web app
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.target !== 'superreddit-extension') return;

    const { type, requestId } = event.data;

    const forwardMsg = { type };
    if (event.data.data) forwardMsg.data = event.data.data;

    chrome.runtime.sendMessage(forwardMsg, (response) => {
      // Handle extension context invalidation (e.g. extension reloaded)
      if (chrome.runtime.lastError) {
        window.postMessage(
          {
            source: 'superreddit-extension',
            requestId,
            error: chrome.runtime.lastError.message,
          },
          '*'
        );
        return;
      }

      window.postMessage(
        {
          source: 'superreddit-extension',
          requestId,
          data: response,
        },
        '*'
      );
    });
  });
})();
