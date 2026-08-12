-- Modernization factory schema.
-- One Postgres instance does three jobs: graph (AGE), vectors (pgvector),
-- and relational tables. Adding Neo4j as a second database is a Phase 2
-- decision, not an MVP one.

CREATE EXTENSION IF NOT EXISTS age;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

LOAD 'age';
SET search_path = ag_catalog, "$user", public;
SELECT create_graph('factory');

-- Immutable raw source. Hash is the identity.
CREATE TABLE IF NOT EXISTS artifact (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id      text NOT NULL,
    app_id      text NOT NULL,
    path        text NOT NULL,
    kind        text NOT NULL CHECK (kind IN
                  ('source','copybook','jcl','ddl','log','schedule','doc','test')),
    sha256      text NOT NULL,
    trust_tier  smallint NOT NULL CHECK (trust_tier BETWEEN 1 AND 4),
    encoding    text,
    size_bytes  bigint,
    ingested_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (run_id, path, sha256)
);

-- Derived facts. The CHECK constraint makes it structurally impossible to
-- store a derived rule without a citation — the database enforces the
-- provenance discipline, not a code review.
CREATE TABLE IF NOT EXISTS fact (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id      text NOT NULL,
    kind        text NOT NULL CHECK (kind IN
                  ('rule','dependency','entrypoint','journey','contract')),
    body        jsonb NOT NULL,
    confidence  real CHECK (confidence BETWEEN 0 AND 1),
    trust_tier  smallint NOT NULL CHECK (trust_tier BETWEEN 1 AND 4),
    status      text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','needs_review','approved','rejected')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT derived_needs_source CHECK (
        trust_tier > 3 OR jsonb_array_length(COALESCE(body->'sources','[]'::jsonb)) > 0
    )
);
CREATE INDEX IF NOT EXISTS fact_run_kind_idx ON fact (run_id, kind);

-- Semantic search over docs, summaries and code chunks.
CREATE TABLE IF NOT EXISTS embedding (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id      text NOT NULL,
    artifact_id uuid REFERENCES artifact(id) ON DELETE CASCADE,
    chunk       text NOT NULL,
    vec         vector(1024)
);
CREATE INDEX IF NOT EXISTS embedding_vec_idx
    ON embedding USING hnsw (vec vector_cosine_ops);

-- Run state, checkpointed per node so a rejection can rewind.
CREATE TABLE IF NOT EXISTS run (
    run_id      text PRIMARY KEY,
    app_id      text NOT NULL,
    status      text NOT NULL,
    state       jsonb NOT NULL,
    cost_usd    numeric(10,4) NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkpoint (
    id          bigserial PRIMARY KEY,
    run_id      text NOT NULL REFERENCES run(run_id) ON DELETE CASCADE,
    node_id     text NOT NULL,
    state       jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkpoint_run_idx ON checkpoint (run_id, id DESC);

-- Hash-chained, append-only. Tampering with any entry breaks verification
-- for everything after it.
CREATE TABLE IF NOT EXISTS ledger (
    seq         bigserial PRIMARY KEY,
    run_id      text NOT NULL,
    actor       text NOT NULL,
    action      text NOT NULL,
    payload     jsonb NOT NULL,
    prev_hash   text NOT NULL,
    hash        text NOT NULL,
    at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_run_idx ON ledger (run_id, seq);

CREATE RULE ledger_no_update AS ON UPDATE TO ledger DO INSTEAD NOTHING;
CREATE RULE ledger_no_delete AS ON DELETE TO ledger DO INSTEAD NOTHING;

-- Every MCP call, allowed or denied.
CREATE TABLE IF NOT EXISTS mcp_audit (
    id          bigserial PRIMARY KEY,
    run_id      text NOT NULL,
    agent_id    text NOT NULL,
    server_id   text NOT NULL,
    tool        text NOT NULL,
    allowed     boolean NOT NULL,
    reason      text,
    latency_ms  real,
    at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mcp_audit_run_idx ON mcp_audit (run_id, at DESC);

CREATE TABLE IF NOT EXISTS gate_decision (
    id          bigserial PRIMARY KEY,
    run_id      text NOT NULL,
    gate_id     text NOT NULL,
    decision    text NOT NULL CHECK (decision IN ('approved','rejected')),
    actor       text NOT NULL,
    note        text,
    decided_at  timestamptz NOT NULL DEFAULT now()
);
