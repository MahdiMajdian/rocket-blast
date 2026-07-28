// A serviceable autopilot, shared by the playtest and the replay self-test.
// It reads the upcoming gate, predicts where moving obstacles will be, and
// detours for coins that are roughly on the way.
module.exports = function makePilot(game) {
  const { G, keys, clamp } = game;

  return function pilot() {
    const L = G.L; if (!L) return;
    let g = null;
    for (const q of L.gates) if (!q.passed && q.z > G.pos.z) { g = q; break; }
    let tx = g ? g.ax : 0, ty = g ? Math.max(g.ay, 10) : 14;
    if (!g && L.target) { tx = L.target.x; ty = L.target.y; }

    if (g && g.obj) {                                  // predict the moving thing
      const o = g.obj, t = (g.z - G.pos.z) / Math.max(G.vel.z, 6);
      if (o.angleAt) {                                 // windmill: aim between arms
        const a = o.angleAt(t) + Math.PI / o.arms, rad = o.r * 0.62;
        tx = Math.cos(a) * rad; ty = o.y + Math.sin(a) * rad;
      } else if (o.xAt) {                              // sliding panel: roomier side
        const px = o.xAt(t);
        tx = clamp(px > 0 ? px - o.w / 2 - 5 : px + o.w / 2 + 5, -18, 18); ty = 15;
      } else if (o.yAt) {                              // bobbing slab: over or under
        const py = o.yAt(t);
        ty = clamp(py > 15 ? py - o.h / 2 - 4 : py + o.h / 2 + 4, 5, 33); tx = 0;
      }
    }

    // grab a coin if it's close ahead and not a big detour
    let best = null, bestD = 1e9;
    for (const c of L.coins) {
      const dz = c.z - G.pos.z;
      if (c.taken || dz < 2 || dz > 34) continue;
      if (g && c.z > g.z + 2) continue;
      if (Math.abs(c.x - tx) + Math.abs(c.y - ty) > 12) continue;
      if (dz < bestD) { bestD = dz; best = c; }
    }
    if (best) { tx = best.x; ty = best.y; }

    const dy = ty - G.pos.y;
    const wantVy = clamp(dy * 1.4, -10, 12);
    const want = clamp((wantVy - G.vel.y) * 0.09, -0.55, 0.9);
    const inv = G.invertPitch ? 1 : -1;                // controls may be flipped
    const noseUp = G.pitch < want;
    keys.up   = inv > 0 ? !noseUp : noseUp;
    keys.down = inv > 0 ? noseUp : !noseUp;
    keys.fire = (G.vel.y < wantVy) || dy > 0;

    const wantVx = clamp((tx - G.pos.x) * 2.2, -20, 20);
    const wantYaw = clamp((wantVx - G.vel.x) * 0.06, -1.1, 1.1);
    keys.left = G.yaw < wantYaw - 0.02;
    keys.right = G.yaw > wantYaw + 0.02;
  };
};
