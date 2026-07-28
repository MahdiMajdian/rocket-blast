CREATE TABLE IF NOT EXISTS scores (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    NOT NULL,
  score     INTEGER NOT NULL,
  coins     INTEGER NOT NULL,
  ticks     INTEGER NOT NULL,   -- 60ths of a second; time = ticks/60
  build     TEXT,
  verify_ms INTEGER,
  created   INTEGER NOT NULL
);
-- the leaderboard query: highest score first, faster time breaks ties
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (score DESC, ticks ASC);
