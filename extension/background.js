// SuperReddit DM Bridge — Background Service Worker
// Handles Reddit cookie-based requests from the content script

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_STATUS') {
    handleCheckStatus().then(sendResponse).catch((err) =>
      sendResponse({ installed: true, redditLoggedIn: false, error: err.message })
    );
    return true; // keep channel open for async response
  }

  if (message.type === 'CHECK_SENT_MESSAGES') {
    handleCheckSentMessages().then(sendResponse).catch((err) =>
      sendResponse({ usernames: [], error: err.message })
    );
    return true;
  }
});

async function getRedditCookies() {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain: '.reddit.com' }, (cookies) => {
      resolve(cookies || []);
    });
  });
}

function buildCookieHeader(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

async function handleCheckStatus() {
  const cookies = await getRedditCookies();
  const sessionCookie = cookies.find(
    (c) => c.name === 'reddit_session' || c.name === 'token_v2' || c.name === 'loid'
  );

  if (!sessionCookie) {
    return { installed: true, redditLoggedIn: false, username: null };
  }

  try {
    const res = await fetch('https://www.reddit.com/api/me.json', {
      headers: {
        Cookie: buildCookieHeader(cookies),
        'User-Agent': 'SuperRedditBridge/1.0',
      },
    });

    if (!res.ok) {
      return { installed: true, redditLoggedIn: false, username: null };
    }

    const data = await res.json();
    const username = data?.data?.name || null;

    return {
      installed: true,
      redditLoggedIn: !!username,
      username,
    };
  } catch (err) {
    return { installed: true, redditLoggedIn: false, username: null, error: err.message };
  }
}

async function handleCheckSentMessages() {
  const cookies = await getRedditCookies();
  const cookieHeader = buildCookieHeader(cookies);
  const allUsernames = new Set();
  let after = null;

  // Fetch up to 3 pages (300 messages max)
  for (let page = 0; page < 3; page++) {
    let url = 'https://www.reddit.com/message/sent.json?limit=100';
    if (after) url += `&after=${after}`;

    try {
      const res = await fetch(url, {
        headers: {
          Cookie: cookieHeader,
          'User-Agent': 'SuperRedditBridge/1.0',
        },
      });

      if (res.status === 429) {
        return { usernames: Array.from(allUsernames), error: 'rate_limited', after };
      }

      if (!res.ok) {
        return { usernames: Array.from(allUsernames), error: `http_${res.status}`, after };
      }

      const data = await res.json();
      const children = data?.data?.children || [];

      for (const child of children) {
        const dest = child?.data?.dest;
        if (dest) allUsernames.add(dest.toLowerCase());
      }

      after = data?.data?.after || null;
      if (!after) break; // no more pages
    } catch (err) {
      return { usernames: Array.from(allUsernames), error: err.message, after };
    }
  }

  return { usernames: Array.from(allUsernames), after };
}
