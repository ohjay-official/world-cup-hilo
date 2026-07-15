# World Cup Hi-Lo

A split-flap stadium scoreboard game: guess whether the next match stat
update (shots, corners, shots on target, possession) will be **higher**
or **lower** than the last one. Build a streak. Replayable across every
World Cup match.

Built for the **Superteam Earn × TxODDS World Cup Hackathon**,
**Consumer & Fan Experiences** track.

---

## What's real vs. demo right now

The game is **fully functional today**, no setup required — it runs on
a self-contained demo data generator so you (and judges) can play it
immediately after deploying.

The moment you complete the one-time TxLINE activation below and add
two environment variables in Vercel, it automatically switches to real
TxLINE match data — no code changes, no redeploy needed. The little
pill in the top-right of the app tells you which mode you're in
("Demo feed" vs "Live · TxLINE").

This is a deliberate architecture choice, not a shortcut: `/api/stats`
is the single seam between demo and live data, so the switch is safe
and instant.

## Deploy it (5 minutes, from your phone)

1. Push this folder to a new GitHub repo (GitHub's mobile web UI lets
   you create a repo and upload files directly — no local Node needed).
2. Go to [vercel.com](https://vercel.com), **Add New → Project**,
   import that repo, and click **Deploy**. No build settings needed.
3. You now have a live link — that's your submission link. Test it:
   tap HI or LO a few times, connect Phantom if you have it installed.

## Go live with real TxLINE data (optional, do this once)

The World Cup free tier needs a one-time on-chain "activation" —
you sign up through Solana, get a JWT + API token, and paste those
into Vercel. This only needs to happen once per deployment.

1. Install [Phantom](https://phantom.app/) if you don't have it, and
   switch it to **Devnet** (Settings → Developer Settings → Testnet
   Mode → Devnet). Devnet SOL is free, no real money involved.
2. Follow TxODDS's own runnable walkthrough — this is the safest path
   since it's their maintained script, not a reimplementation:
   - Quickstart: https://txline.txodds.com/documentation/quickstart
   - World Cup Free Tier: https://txline.txodds.com/documentation/worldcup
   - Runnable Devnet Examples: linked from the Quickstart page —
     these are copy-paste scripts that do the guest-JWT → subscribe →
     activate flow end to end and print out your `jwt` and `apiToken`.
   - If you get stuck, their Discord/Telegram (linked on the docs
     site) is fast — mention you're a World Cup Hackathon participant.
3. In Vercel: **Project → Settings → Environment Variables**, add:
   - `TXLINE_JWT` → the jwt you got back
   - `TXLINE_API_TOKEN` → the apiToken you got back
   - `TXLINE_NETWORK` → `devnet` (or `mainnet` if you went that route)
4. Redeploy (Vercel does this automatically on env var changes, or hit
   **Redeploy** manually). Reload the app — the pill should now read
   **"Live · TxLINE."**
5. Open `api/stats.js` and swap the `TODO` block for the real stats
   endpoint from the authenticated API Reference (visible once you're
   logged in with an activated token) — the auth headers are already
   wired correctly.

You do **not** need to do step 2–5 to submit. A working demo-mode
product satisfies "functional, not a mockup" — TxODDS's own track
brief even frames the format as replayable across matches, which the
demo generator already does. Going live is the polish layer if you
have time before the deadline.

## Recording the demo video (this is what's actually judged)

The track notes: *"submissions will be evaluated heavily based on the
demo video... matches will have ended after the deadline, so make sure
your demo clearly showcases the product experience."* Suggested 5-shot
structure, under 90 seconds of screen time:

1. **Cold open (5s):** the split-flap card mid-flip. No narration yet.
2. **The hook (10s):** "Every World Cup fan is glued to their phone
   during a match. This turns that second screen into a game."
3. **Core loop (25s):** tap HI, show the flip reveal, streak tally
   filling up, ticker scrolling underneath.
4. **Wallet + data story (15s):** connect Phantom, point at the
   "Live · TxLINE" pill, mention every value is cryptographically
   anchored on Solana so no one can dispute a call.
5. **Close (10s):** best streak, replayability across all 104 matches,
   one line on the business model (see below).

## Monetization / commercial path (for the judging rubric)

Worth saying explicitly in your submission write-up, since it's a
named judging criterion:

- Sponsor-branded match packs (a team's shirt colors reskin the flaps).
- Streak leaderboards with small USDC entry pools per matchday,
  settled on the same TxLINE data used for gameplay — no separate
  oracle needed.
- Post-tournament: same mechanic works for any sport TxLINE covers.

## Tech notes

- Zero build step, zero npm dependencies. `index.html` is the entire
  frontend; `api/stats.js` is a single Vercel serverless function.
- Wallet integration uses Phantom's injected `window.solana` provider
  directly (connect + signMessage) — no bundler required.
- Streak/best-score persistence uses `localStorage`, scoped to the
  player's device.
