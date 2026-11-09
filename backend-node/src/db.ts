import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(__dirname, "..", "..");
const dataDir = path.join(root, "backend-node", "data");
fs.mkdirSync(dataDir, { recursive: true });
export const db = new Database(process.env.NODE_DB_PATH || path.join(dataDir, "vegah.db"));
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS documents (
  doc_id TEXT PRIMARY KEY, title TEXT NOT NULL, filename TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chunks (
  chunk_id TEXT PRIMARY KEY, doc_id TEXT NOT NULL REFERENCES documents(doc_id),
  section TEXT NOT NULL, page_number INTEGER NOT NULL, content TEXT NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(chunk_id UNINDEXED, content);
CREATE TABLE IF NOT EXISTS vault_notes (
  slug TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL,
  tags TEXT NOT NULL, content TEXT NOT NULL
);
`);

export type Chunk = { chunk_id: string; doc_id: string; doc_title: string; section: string; page_number: number; content: string };
export function searchChunks(query: string, limit = 6): Chunk[] {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(t => `"${t.replace(/"/g, "")}"`).join(" OR ");
  if (!terms) return [];
  try {
    return db.prepare(`SELECT c.chunk_id, c.doc_id, d.title AS doc_title, c.section, c.page_number, c.content
      FROM chunks_fts f JOIN chunks c ON c.chunk_id=f.chunk_id JOIN documents d ON d.doc_id=c.doc_id
      WHERE chunks_fts MATCH ? LIMIT ?`).all(terms, limit) as Chunk[];
  } catch { return []; }
}
