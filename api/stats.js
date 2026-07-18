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
