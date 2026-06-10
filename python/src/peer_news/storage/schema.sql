CREATE TABLE IF NOT EXISTS items (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    url             TEXT NOT NULL,
    content         TEXT,
    source          TEXT NOT NULL,
    source_type     TEXT NOT NULL,
    published       TEXT,
    authors         TEXT,
    metadata        TEXT,
    fetched_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(url)
);

CREATE TABLE IF NOT EXISTS item_tags (
    item_id         TEXT NOT NULL REFERENCES items(id),
    tag             TEXT NOT NULL,
    matched_rule    TEXT,
    PRIMARY KEY (item_id, tag)
);

CREATE TABLE IF NOT EXISTS item_scores (
    item_id         TEXT NOT NULL REFERENCES items(id),
    run_id          TEXT NOT NULL,
    score           REAL NOT NULL,
    breakdown       TEXT,
    scored_at       TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (item_id, run_id)
);

CREATE TABLE IF NOT EXISTS feedback (
    item_id         TEXT NOT NULL REFERENCES items(id),
    action          TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runs (
    id              TEXT PRIMARY KEY,
    started_at      TEXT NOT NULL,
    finished_at     TEXT,
    items_fetched   INTEGER DEFAULT 0,
    items_scored    INTEGER DEFAULT 0,
    items_output    INTEGER DEFAULT 0,
    config_hash     TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_source ON items(source);
CREATE INDEX IF NOT EXISTS idx_items_fetched ON items(fetched_at);
CREATE INDEX IF NOT EXISTS idx_scores_score ON item_scores(score);
