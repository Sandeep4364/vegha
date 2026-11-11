import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in the environment."
      );
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export interface Chunk {
  chunk_id: string;
  doc_id: string;
  doc_title: string;
  section: string;
  page_number: number;
  content: string;
  embedding?: number[] | null;
}

export function parseWebsearchTerms(query: string): string[] {
  const terms: string[] = [];
  const phraseRe = /"([^"]+)"/g;
  let m: RegExpExecArray | null;
  const phrases: string[] = [];
  let rest = query;
  while ((m = phraseRe.exec(rest)) !== null) phrases.push(m[1]);
  rest = rest.replace(phraseRe, " ");
  for (const t of rest.split(/\s+/)) {
    const cleaned = t.replace(/[^a-zA-Z0-9_]/g, "");
    if (cleaned) terms.push(cleaned);
  }
  for (const p of phrases) terms.push(...p.split(/\s+/).filter(Boolean));
  return [...new Set(terms)];
}

export async function searchChunks(query: string, limit = 6): Promise<Chunk[]> {
  const terms = parseWebsearchTerms(query);
  if (!terms.length) return [];
  const tsquery = terms.join(" | ");
  const supabase = getClient();
  const { data, error } = await supabase
    .from("chunks")
    .select("chunk_id, doc_id, section, page_number, content, documents(title)")
    .textSearch("content_tsv", tsquery, { type: "websearch" })
    .limit(limit);
  if (error) throw new Error(`Document search failed: ${error.message}`);
  return (data || []).map((row: any) => ({
    chunk_id: row.chunk_id,
    doc_id: row.doc_id,
    doc_title: row.documents?.title ?? "",
    section: row.section,
    page_number: row.page_number,
    content: row.content,
  }));
}

export async function searchSemantic(queryEmbedding: number[], limit = 6): Promise<Chunk[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("chunks")
    .select("chunk_id, doc_id, section, page_number, content, embedding, documents(title)")
    .not("embedding", "is", null);
  if (error) throw new Error(`Semantic search failed: ${error.message}`);
  const norm = Math.sqrt(queryEmbedding.reduce((sum, value) => sum + value * value, 0)) || 1;
  return (data || [])
    .map((row: any) => {
      const vector = Array.isArray(row.embedding) ? row.embedding : [];
      const vectorNorm = Math.sqrt(vector.reduce((sum: number, value: number) => sum + value * value, 0)) || 1;
      const score = vector.length === queryEmbedding.length
        ? vector.reduce((sum: number, value: number, index: number) => sum + value * queryEmbedding[index], 0) / (norm * vectorNorm)
        : -1;
      return { score, row };
    })
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }: any) => ({
      chunk_id: row.chunk_id, doc_id: row.doc_id, doc_title: row.documents?.title ?? "",
      section: row.section, page_number: row.page_number, content: row.content,
    }));
}

export async function listMissingEmbeddings(limit = 100): Promise<Array<{ chunk_id: string; content: string }>> {
  const supabase = getClient();
  const { data, error } = await supabase.from("chunks").select("chunk_id, content").is("embedding", null).limit(limit);
  if (error) throw new Error(`Failed to list chunks without embeddings: ${error.message}`);
  return data || [];
}

export async function updateChunkEmbedding(chunkId: string, embedding: number[]): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("chunks").update({ embedding }).eq("chunk_id", chunkId);
  if (error) throw new Error(`Failed to save chunk embedding: ${error.message}`);
}

export async function listDocuments(): Promise<
  Array<{ doc_id: string; title: string; filename: string; created_at: string; chunk_count: number }>
> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("documents")
    .select("doc_id, title, filename, created_at, chunks(count)");
  if (error) throw new Error(`Failed to list documents: ${error.message}`);
  return (data || []).map((row: any) => ({
    doc_id: row.doc_id,
    title: row.title,
    filename: row.filename,
    created_at: row.created_at,
    chunk_count: row.chunks?.[0]?.count ?? 0,
  }));
}

export async function getChunk(chunkId: string): Promise<Chunk | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("chunks")
    .select("chunk_id, doc_id, section, page_number, content, documents(title)")
    .eq("chunk_id", chunkId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load citation: ${error.message}`);
  if (!data) return null;
  return {
    chunk_id: data.chunk_id,
    doc_id: data.doc_id,
    doc_title: (data as any).documents?.title ?? "",
    section: data.section,
    page_number: data.page_number,
    content: data.content,
  };
}

export async function insertDocument(doc: {
  doc_id: string;
  title: string;
  filename: string;
  created_at: string;
}): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("documents").insert(doc);
  if (error) throw new Error(`Failed to save document: ${error.message}`);
}

export async function insertChunks(
  rows: Array<{ chunk_id: string; doc_id: string; section: string; page_number: number; content: string; embedding?: number[] | null }>
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("chunks").insert(rows);
  if (error) throw new Error(`Failed to save document chunks: ${error.message}`);
}

export async function listVaultNotes(): Promise<Array<{ slug: string; title: string; type: string; tags: string[]; content: string }>> {
  const supabase = getClient();
  const { data, error } = await supabase.from("vault_notes").select("*").order("title");
  if (error) throw new Error(`Failed to load vault notes: ${error.message}`);
  return (data || []).map((n: any) => ({ ...n, tags: Array.isArray(n.tags) ? n.tags : [] }));
}

export async function upsertVaultNote(note: {
  slug: string;
  title: string;
  type: string;
  tags: string[];
  content: string;
}): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from("vault_notes").upsert(note, { onConflict: "slug" });
  if (error) throw new Error(`Failed to save vault note: ${error.message}`);
}
