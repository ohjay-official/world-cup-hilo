/**
 * /api/stats
 *
 * This endpoint is the ONLY place that ever talks to TxLINE. Secrets
 * (JWT / API token) live here as Vercel environment variables and are
 * never sent to the browser.
 *
 * Until TXLINE_API_TOKEN is set (see README, "Go live"), this always
 * answers { mode: "demo" } and the client runs its own self-contained
 * demo generator, so the product is fully functional with zero setup.
 *
 * Once credentials are set, it switches to live mode and reads one
 * event off the GET /odds/stream endpoint per request, this is the
 * exact endpoint we watched stream real World Cup odds data during
 * our own devnet activation run.
 */

const GUEST_JWT_URL = process.env.TXLINE_NETWORK === 'mainnet'
  ? 'https://txline.txodds.com/auth/guest/start'
  : 'https://txline-dev.txodds.com/auth/guest/start';

const API_BASE = process.env.TXLINE_NETWORK === 'mainnet'
  ? 'https://txline.txodds.com/api'
  : 'https://txline-dev.txodds.com/api';

function hasLiveCredentials() {
  return Boolean(process.env.TXLINE_API_TOKEN);
}

async function getFreshJwt() {
  const res = await fetch(GUEST_JWT_URL, { method: 'POST' });
  if (!res.ok) throw new Error('guest jwt request failed: ' + res.status);
  const data = await res.json();
  return data.token;
}

async function fetchLiveTick(afterMinute) {
  const jwt = await getFreshJwt();
  const apiToken = process.env.TXLINE_API_TOKEN;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${API_BASE}/odds/stream`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Api-Token': apiToken,
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error('txline stream request failed: ' + res.status);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;

        let payload;
        try {
          payload = JSON.parse(jsonStr);
        } catch (e) {
          continue;
        }

        const price = Array.isArray(payload.Prices) ? payload.Prices[0] : null;
        if (price === null || price === undefined) continue;

        reader.cancel();
        clearTimeout(timeout);
        return {
          minute: afterMinute + 1,
          statKey: payload.SuperOddsType || 'odds',
          statLabel: 'Live Odds - ' + (payload.SuperOddsType || 'Market').replace(/_/g, ' '),
          value: Math.round(price),
          isPercent: false,
        };
      }
    }
    throw new Error('stream ended before any usable event arrived');
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const live = hasLiveCredentials();

  if (req.query.probe) {
    return res.status(200).json({ mode: live ? 'live' : 'demo' });
  }

  if (!live) {
    return res.status(200).json({ mode: 'demo' });
  }

  try {
    const after = Number(req.query.after || 0);
    const tick = await fetchLiveTick(after);
    return res.status(200).json({ mode: 'live', tick });
  } catch (err) {
    console.error('TxLINE live fetch failed, falling back to demo:', err.message);
    if (req.query.debug) {
      return res.status(200).json({ mode: 'demo', debugError: err.message });
    }
    return res.status(200).json({ mode: 'demo' });
  }
}
