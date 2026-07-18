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
 * Once credentials are set, it switches to live mode and fetches real
 * TxLINE data via GET /odds/snapshot/{fixtureId}, the exact endpoint
 * verified working during our own devnet activation run.
 */

const GUEST_JWT_URL = process.env.TXLINE_NETWORK === 'mainnet'
  ? 'https://txline.txodds.com/auth/guest/start'
  : 'https://txline-dev.txodds.com/auth/guest/start';

const API_BASE = process.env.TXLINE_NETWORK === 'mainnet'
  ? 'https://txline.txodds.com/api'
  : 'https://txline-dev.txodds.com/api';

const FIXTURE_ID = 17588320;

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

  const res = await fetch(`${API_BASE}/odds/snapshot/${FIXTURE_ID}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      'X-Api-Token': apiToken,
    },
  });
  if (!res.ok) throw new Error('txline odds request failed: ' + res.status);
  const raw = await res.json();

  const list = Array.isArray(raw) ? raw : raw.data || [];
  if (!list.length) throw new Error('empty odds snapshot');
  const latest = list[list.length - 1];
  const price = Array.isArray(latest.Prices) ? latest.Prices[0] : null;
  if (price === null || price === undefined) throw new Error('no price in snapshot');

  return {
    minute: afterMinute + 1,
    statKey: latest.SuperOddsType || 'odds',
    statLabel: 'Live Odds - ' + (latest.SuperOddsType || 'Market').replace(/_/g, ' '),
    value: Math.round(price),
    isPercent: false,
  };
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
