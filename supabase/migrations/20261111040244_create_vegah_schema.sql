/*
# Create VEGAH document intelligence schema

1. Plain-English summary
   This creates the permanent home for the app's data in Supabase: indexed
   documents, their searchable text chunks, and the Obsidian-style knowledge
   vault notes. It replaces the local SQLite file the backend used before.

2. New Tables
   - `documents`: one row per ingested document
     - `doc_id` (text, primary key) — unique document identifier
     - `title` (text) — human-readable title
     - `filename` (text) — original file name
     - `created_at` (timestamptz) — ingestion timestamp
   - `chunks`: searchable text pieces extracted from documents
     - `chunk_id` (text, primary key)
     - `doc_id` (text) — link to the parent document (deletes cascade)
     - `section` (text) — section label
     - `page_number` (integer) — position within the document
     - `content` (text) — the chunk text
     - `content_tsv` (tsvector, generated) — full-text search index over `content`
   - `vault_notes`: knowledge-vault notes with wiki links
     - `slug` (text, primary key)
     - `title` (text), `type` (text), `content` (text)
     - `tags` (jsonb) — list of tags

3. Indexes
   - GIN index on `chunks.content_tsv` for fast full-text search.
   - Index on `chunks.doc_id` for document/chunk joins and counts.

4. Security
   - Row Level Security enabled on all three tables.
   - Single-tenant app with no sign-in, so policies are scoped to
     `anon, authenticated` and intentionally allow full access — the data is
     shared, public app data.
   - Grants limited to the verbs the app uses: documents and chunks are
     readable and insertable; vault notes are also updatable (note upserts).
     No DELETE grant exists, so records cannot be wiped through the API.
*/

CREATE TABLE IF NOT EXISTS documents (
  doc_id text PRIMARY KEY,
  title text NOT NULL,
  filename text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chunks (
  chunk_id text PRIMARY KEY,
  doc_id text NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  section text NOT NULL,
  page_number integer NOT NULL,
  content text NOT NULL,
  embedding jsonb,
  content_tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

CREATE INDEX IF NOT EXISTS chunks_fts_idx ON chunks USING GIN (content_tsv);
CREATE INDEX IF NOT EXISTS chunks_doc_id_idx ON chunks (doc_id);
ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding jsonb;

CREATE TABLE IF NOT EXISTS vault_notes (
  slug text PRIMARY KEY,
  title text NOT NULL,
  type text NOT NULL,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  content text NOT NULL
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_notes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON documents, chunks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON vault_notes TO anon, authenticated;
REVOKE DELETE ON documents, chunks, vault_notes FROM anon, authenticated;
REVOKE UPDATE ON documents, chunks FROM anon, authenticated;

DROP POLICY IF EXISTS "public_select_documents" ON documents;
CREATE POLICY "public_select_documents" ON documents FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_documents" ON documents;
CREATE POLICY "public_insert_documents" ON documents FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_select_chunks" ON chunks;
CREATE POLICY "public_select_chunks" ON chunks FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_chunks" ON chunks;
CREATE POLICY "public_insert_chunks" ON chunks FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_select_vault_notes" ON vault_notes;
CREATE POLICY "public_select_vault_notes" ON vault_notes FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_insert_vault_notes" ON vault_notes;
CREATE POLICY "public_insert_vault_notes" ON vault_notes FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "public_update_vault_notes" ON vault_notes;
CREATE POLICY "public_update_vault_notes" ON vault_notes FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);