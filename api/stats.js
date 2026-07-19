/**
 * /api/stats
 *
 * This endpoint is the ONLY place that ever talks to TxLINE. Secrets
 * (the API token) live here as a Vercel environment variable and are
 * never sent to the browser.
 *
 * Until TXLINE_API_TOKEN is set (see README, "Go live"), this always
 * answers { mode: "demo" } and the client runs its own self-contained
 * demo generator, so the product is fully functional with zero setup.
 *
 * Once set, this mints a fresh guest JWT per request (the JWT is a
 * short-lived session token by design) and calls two confirmed-working
 * REST endpoints: /api/fixtures/snapshot to find a live World Cup
 * fixture, then /api/odds/snapshot/{fixtureId} for that fixture's
 * odds. Both were verified working live during our devnet activation.
 */

const GUEST_JWT_URL = process.env.TXLINE_NETWORK === 'mainnet'
  ? 'https://txline.txodds.com/auth/guest/start'
  : 'https://txline-dev.txodds.com/auth/guest/start';

const API_BASE = process.env.TXLINE_NETWORK === 'mainnet'
  ? 'https://txline.txodds.com/api'
  : 'https://txline-dev.txodds.com/api';

// Confirmed live: competitionId 72 = FIFA World Cup on TxLINE.
const WORLD_CUP_COMPETITION_ID = 72;

function hasLiveCredentials() {
  return Boolean(process.env.TXLINE_API_TOKEN);
}

async function getFreshJwt() {
  const res = await fetch(GUEST_JWT_URL, { method: 'POST' });
  if (!res.ok) throw new Error('guest jwt request failed: ' + res.status);
  const data = await res.json();
  return data.token;
}

// Cache the fixture id for the lifetime of this function instance so
// we don't re-fetch the fixtures list on every single guess.
let cachedFixtureId = null;

async function getFixtureId(jwt, apiToken) {
  if (cachedFixtureId) return cachedFixtureId;

  const res = await fetch(
    `${API_BASE}/fixtures/snapshot?competitionId=${WORLD_CUP_COMPETITION_ID}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Api-Token': apiToken,
      },
    }
  );
  if (!res.ok) throw new Error('fixtures snapshot failed: ' + res.status);
  const fixtures = await res.json();
  if (!Array.isArray(fixtures) || !fixtures.length) {
    throw new Error('no World Cup fixtures returned');
  }

  cachedFixtureId = fixtures[0].FixtureId;
  return cachedFixtureId;
}

async function fetchLiveTick(afterMinute) {
  const jwt = await getFreshJwt();
  const apiToken = process.env.TXLINE_API_TOKEN;

  const fixtureId = await getFixtureId(jwt, apiToken);

  const res = await fetch(
    `${API_BASE}/odds/snapshot/${fixtureId}?asOf=${Date.now()}`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        'X-Api-Token': apiToken,
      },
    }
  );
  if (!res.ok) throw new Error('odds snapshot failed: ' + res.status);
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
