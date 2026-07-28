// Rocket Blast leaderboard — Cloudflare Worker + D1.
//
//   POST /score   { name, score, coins, ticks, levels, inv, build, replay }
//                 -> replays the inputs, stores the score only if it checks out
//   GET  /top     -> the leaderboard
//
// Lives entirely outside GitHub Pages, so redeploying the game never touches it.
import { createGame } from './game.gen.js';

const BITS = [['up',1], ['down',2], ['left',4], ['right',8], ['fire',16], ['restart',32]];
const MAX_TICKS = 60 * 60 * 60;          // one hour of game time
const MAX_REPLAY_B64 = 400 * 1024;       // ~24 minutes of dense input

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } });

function decodeReplay(b64) {
  const bin = atob(b64);
  const masks = [];
  for (let i = 0; i + 2 < bin.length; i += 3) {
    const m = bin.charCodeAt(i);
    const n = bin.charCodeAt(i + 1) | (bin.charCodeAt(i + 2) << 8);
    if (masks.length + n > MAX_TICKS) throw new Error('replay too long');
    for (let k = 0; k < n; k++) masks.push(m);
  }
  return masks;
}

/** Re-runs the submitted inputs and returns what the simulation really produced. */
function verify(sub) {
  const masks = decodeReplay(sub.replay);
  const { G, ST, keys, LEVELS, BUILD, stepFromMask } = createGame();

  if (sub.build !== BUILD)
    return { ok: false, reason: `replay is from build ${sub.build}, server runs ${BUILD}` };
  if (sub.levels !== LEVELS.length)
    return { ok: false, reason: `replay covers ${sub.levels} levels, server has ${LEVELS.length}` };

  G.invertPitch = !!sub.inv;
  for (const [k] of BITS) keys[k] = false;

  for (let i = 0; i < masks.length; i++) {
    stepFromMask(masks[i]);          // the game's own tick, cheat bits included
    if (G.state === ST.WIN) break;
  }

  if (G.state !== ST.WIN) return { ok: false, reason: 'replay does not finish the game' };
  if (G.cheated)          return { ok: false, reason: 'cheats were used' };
  if (G.score !== sub.score || G.coins !== sub.coins || Math.abs(G.runTicks - sub.ticks) > 1)
    return { ok: false, reason: 'claimed result does not match the replay' };

  return { ok: true, score: G.score, coins: G.coins, ticks: G.runTicks };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = url.pathname.replace(/^\/api/, '') || '/';

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    if (request.method === 'GET' && route === '/top') {
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('n') || '20', 10)));
      const { results } = await env.DB.prepare(
        `SELECT name, score, coins, ticks, created FROM scores
         ORDER BY score DESC, ticks ASC LIMIT ?`).bind(limit).all();
      return json({ top: results || [] });
    }

    if (request.method === 'POST' && route === '/score') {
      let sub;
      try { sub = await request.json(); }
      catch { return json({ error: 'bad json' }, 400); }

      const name = String(sub.name || 'ANON').replace(/[^\x20-\x7E]/g, '').trim().slice(0, 16) || 'ANON';
      if (typeof sub.replay !== 'string' || sub.replay.length > MAX_REPLAY_B64)
        return json({ error: 'replay missing or too large' }, 400);
      if (!Number.isInteger(sub.score) || !Number.isInteger(sub.ticks))
        return json({ error: 'bad score payload' }, 400);

      let result;
      const t0 = Date.now();
      try { result = verify(sub); }
      catch (e) { return json({ error: 'replay rejected: ' + e.message }, 400); }
      if (!result.ok) return json({ error: result.reason }, 400);

      await env.DB.prepare(
        `INSERT INTO scores (name, score, coins, ticks, build, verify_ms, created)
         VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(name, result.score, result.coins, result.ticks, sub.build, Date.now() - t0, Date.now())
        .run();

      const { results } = await env.DB.prepare(
        `SELECT COUNT(*) AS better FROM scores WHERE score > ? OR (score = ? AND ticks < ?)`)
        .bind(result.score, result.score, result.ticks).all();

      return json({ ok: true, rank: (results?.[0]?.better ?? 0) + 1, score: result.score });
    }

    return json({ error: 'not found' }, 404);
  },
};
