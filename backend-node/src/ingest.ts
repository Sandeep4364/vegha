import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mammoth from "mammoth";
import pdf from "pdf-parse";
import { insertDocument, insertChunks } from "./db";
import { embed } from "./ai";

export async function extractText(file: string, ext: string): Promise<string> {
  if (ext === ".docx") return (await mammoth.extractRawText({ path: file })).value;
  if (ext === ".pdf") return (await pdf(await fs.readFile(file))).text;
  return fs.readFile(file, "utf8");
}

export async function ingest(file: string, originalName: string): Promise<{ docId: string; count: number }> {
  const ext = path.extname(originalName).toLowerCase();
  const text = (await extractText(file, ext)).replace(/\r/g, "").trim();
  if (!text) throw new Error("The uploaded document contains no readable text.");
  const docId = crypto.randomUUID();
  const title = path.basename(originalName, ext).replace(/[_-]+/g, " ").trim() || "Document";
  const paragraphs = text.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  const chunks = paragraphs.length ? paragraphs : [text];
  await insertDocument({ doc_id: docId, title, filename: originalName, created_at: new Date().toISOString() });
  const rows = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const content = chunks[i];
    let embedding: number[] | null = null;
    try { embedding = await embed(content); } catch (error) {
      console.warn(`Embedding skipped for ${originalName} chunk ${i + 1}: ${(error as Error).message}`);
    }
    rows.push({
      chunk_id: `${docId}-${i + 1}`,
      doc_id: docId,
      section: `Section ${i + 1}`,
      page_number: i + 1,
      content,
      embedding,
    });
  }
  await insertChunks(rows);
  return { docId, count: chunks.length };
}
