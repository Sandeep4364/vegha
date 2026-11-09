import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mammoth from "mammoth";
import pdf from "pdf-parse";
import { db } from "./db";

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
  const insertDoc = db.prepare("INSERT INTO documents VALUES (?, ?, ?, ?)");
  const insertChunk = db.prepare("INSERT INTO chunks VALUES (?, ?, ?, ?, ?)");
  const insertFts = db.prepare("INSERT INTO chunks_fts VALUES (?, ?)");
  db.transaction(() => {
    insertDoc.run(docId, title, originalName, new Date().toISOString());
    chunks.forEach((content, i) => {
      const id = `${docId}-${i + 1}`;
      insertChunk.run(id, docId, `Section ${i + 1}`, i + 1, content);
      insertFts.run(id, content);
    });
  })();
  return { docId, count: chunks.length };
}
