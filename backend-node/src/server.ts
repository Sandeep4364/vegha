import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { db, searchChunks } from "./db";
import { ingest } from "./ingest";

const app = express();
const port = Number(process.env.PORT || 8000);
const root = path.resolve(__dirname, "..", "..");
const complianceDir = path.join(root, "sample_documents", "compliance_frameworks");
const uploads = path.join(root, "backend-node", "data", "uploads");
fs.mkdirSync(uploads, { recursive: true });
const upload = multer({ dest: uploads, limits: { fileSize: 25 * 1024 * 1024 } });
app.use(cors());
app.use(express.json({ limit: "2mb" }));

function frameworks(): any[] {
  return fs.readdirSync(complianceDir).filter(x => x.endsWith(".json")).flatMap(file => {
    const items = JSON.parse(fs.readFileSync(path.join(complianceDir, file), "utf8"));
    return [{ id: file.replace(/_Checklist\.json$/, ""), name: items[0]?.framework || file, count: items.length, items }];
  });
}
function notes() {
  return db.prepare("SELECT slug,title,type,tags,content FROM vault_notes").all().map((n: any) => ({ ...n, tags: JSON.parse(n.tags) }));
}
const VAULT_CROSS_LINKS: Record<string, string[]> = {
  "access-control-and-key-management-runbook": ["SOC2 Information Security Policy", "Data Retention and Privacy Policy"],
  "incident-response-plan-sop": ["SOC2 Information Security Policy", "Access Control and Key Management Runbook"],
  "data-retention-and-privacy-policy": ["SOC2 Information Security Policy", "Access Control and Key Management Runbook"],
  "soc2-information-security-policy": ["Incident Response Plan SOP", "Access Control and Key Management Runbook", "Data Retention and Privacy Policy"]
};
function seedVault() {
  const docs = fs.readdirSync(path.join(root, "sample_documents")).filter(x => /\.(md|txt)$/i.test(x));
  const insert = db.prepare("INSERT OR REPLACE INTO vault_notes VALUES (?, ?, ?, ?, ?)");
  docs.forEach(file => {
    const slug = file.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const title = file.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    const body = fs.readFileSync(path.join(root, "sample_documents", file), "utf8");
    const related = VAULT_CROSS_LINKS[slug];
    const content = related ? `${body}\n\n## Related Notes\n${related.map(t => `- [[${t}]]`).join("\n")}` : body;
    insert.run(slug, title, "policy", JSON.stringify(["compliance", "source"]), content);
  });
}
seedVault();
async function seedSampleDocuments() {
  const sampleDir = path.join(root, "sample_documents");
  const existing = new Set(
    (db.prepare("SELECT filename FROM documents").all() as Array<{ filename: string }>)
      .map(document => document.filename)
  );
  const samples = fs.readdirSync(sampleDir)
    .filter(file => /\.(md|txt|pdf|docx)$/i.test(file))
    .filter(file => !existing.has(file));

  for (const file of samples) {
    await ingest(path.join(sampleDir, file), file);
  }
}

app.get("/", (_req, res) => res.json({ status: "healthy", service: "Vegah Node Backend", version: "1.0.0", mcp_tools_available: 8, cost_model: "Deterministic local retrieval (no secrets required)" }));
app.get("/api/health/providers", (_req, res) => res.json({ active_provider: "autonomous_fallback", provider: "local", available: true, fallback_order: ["autonomous_fallback"], recent_failures: [] }));
app.get("/api/documents", (_req, res) => res.json(db.prepare("SELECT d.doc_id,d.title,d.filename,d.created_at,COUNT(c.chunk_id) AS chunk_count FROM documents d LEFT JOIN chunks c ON c.doc_id=d.doc_id GROUP BY d.doc_id ORDER BY d.created_at DESC").all()));
app.post("/api/documents/upload", upload.single("file"), async (req, res, next) => {
  const file = req.file; const original = path.basename(file?.originalname || "");
  if (!file || !/\.(pdf|docx|md|markdown|txt)$/i.test(original)) { if (file) fs.unlinkSync(file.path); return res.status(415).json({ detail: "Unsupported file type. Upload PDF, DOCX, Markdown, or TXT files." }); }
  try { const result = await ingest(file.path, original); const slug = original.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-"); db.prepare("INSERT OR REPLACE INTO vault_notes VALUES (?, ?, ?, ?, ?)").run(slug, original.replace(/\.[^.]+$/, ""), "uploaded-document", JSON.stringify(["uploaded", "audit-scope"]), `# ${original}\n\nIndexed chunks: ${result.count}`); res.json({ success: true, filename: original, chunks_indexed: result.count, doc_id: result.docId }); } catch (e) { next(e); } finally { if (fs.existsSync(file.path)) fs.unlinkSync(file.path); }
});
app.get("/api/compliance/frameworks", (_req, res) => res.json(frameworks().map(({ id, name, count }) => ({ id, name, count }))));
app.get("/api/compliance/evaluate/:framework_id", (req, res) => {
  const fw = frameworks().find(x => x.id === req.params.framework_id);
  if (!fw) return res.status(404).json({ detail: "Framework not found" });
  const findings = fw.items.map((item: any) => { const matches = searchChunks(`${item.title} ${item.requirement}`, 2); const status = matches.length ? (matches[0].content.length > 180 ? "COVERED" : "PARTIALLY_COVERED") : "MISSING"; return { id: item.id, title: item.title, category: item.category, requirement: item.requirement, status, confidence: matches.length ? 0.75 : 0.1, evidence: matches.map(c => ({ chunk_id: c.chunk_id, doc_title: c.doc_title, section: c.section, page_number: c.page_number, relevance_score: 0.75, verbatim_excerpt: c.content.slice(0, 300) })), gaps: status === "MISSING" ? ["No matching evidence was found in the indexed documents."] : [], remediation: status === "MISSING" ? "Create and publish a policy covering this requirement." : "Review evidence and maintain periodic testing." }; });
  const covered = findings.filter((x: any) => x.status === "COVERED").length, partial = findings.filter((x: any) => x.status === "PARTIALLY_COVERED").length;
  res.json({ framework_id: fw.id, framework_name: fw.name, total_requirements: findings.length, covered, partially_covered: partial, missing: findings.length - covered - partial, compliance_score: findings.length ? Math.round((covered + partial * 0.5) / findings.length * 100) : 0, findings });
});
app.get("/api/vault/notes", (_req, res) => res.json(notes().map(({ content, ...n }) => n)));
type NoteLink = { id: string; title: string };
function linkMaps(all: ReturnType<typeof notes>) {
  const byTitle = new Map<string, any>(all.flatMap((n: any) => [[n.slug, n], [n.title.toLowerCase(), n]]));
  const outgoing = new Map<string, NoteLink[]>();
  const backlinks = new Map<string, NoteLink[]>();
  const push = (map: Map<string, NoteLink[]>, key: string, val: NoteLink) => {
    const arr = map.get(key) || [];
    if (!arr.some(x => x.id === val.id)) { arr.push(val); map.set(key, arr); }
  };
  all.forEach((note: any) => {
    for (const match of note.content.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g)) {
      const target = byTitle.get(match[1].trim().toLowerCase());
      if (!target || target.slug === note.slug) continue;
      push(outgoing, note.slug, { id: target.slug, title: target.title });
      push(backlinks, target.slug, { id: note.slug, title: note.title });
    }
  });
  return { outgoing, backlinks };
}
app.get("/api/vault/notes/:slug", (req, res) => {
  const all = notes();
  const note = all.find((n: any) => n.slug === req.params.slug);
  if (!note) return res.status(404).json({ detail: "Note not found" });
  const { outgoing, backlinks } = linkMaps(all);
  return res.json({ ...note, outgoing: outgoing.get(note.slug) || [], backlinks: backlinks.get(note.slug) || [] });
});
function graph() {
  const all = notes();
  const { outgoing } = linkMaps(all);
  const links: Array<{ source: string; target: string; label: string }> = [];
  outgoing.forEach((targets, source) => targets.forEach(t => links.push({ source, target: t.id, label: "wikilink" })));
  const counts = new Map<string, number>();
  links.forEach(l => { counts.set(l.source, (counts.get(l.source) || 0) + 1); counts.set(l.target, (counts.get(l.target) || 0) + 1); });
  return {
    nodes: all.map((n: any) => ({ id: n.slug, label: n.title, type: n.type, tags: n.tags, connections: counts.get(n.slug) || 0, val: Math.max(1, counts.get(n.slug) || 1) })),
    links: links.filter((l, i, a) => a.findIndex(x => x.source === l.source && x.target === l.target) === i)
  };
}
app.get("/api/vault/graph", (_req, res) => res.json(graph()));
app.post("/api/compliance/gap-analysis", (req, res) => {
  const title = String(req.body?.title || "").trim();
  const requirementText = String(req.body?.requirement_text || "").trim();
  if (!title || !requirementText) return res.status(400).json({ detail: "title and requirement_text are required" });
  const result = callTool("perform_gap_analysis", {
    requirement_id: String(req.body?.requirement_id || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")),
    title,
    requirement_text: requirementText,
    category: req.body?.category
  });
  res.json(result);
});
const tools = [
  { name: "search_documents", description: "Search indexed enterprise documents.", inputSchema: { type: "object", properties: { query: { type: "string" }, top_k: { type: "integer", default: 4 }, doc_id_filter: { type: "string" } }, required: ["query"] } },
  { name: "retrieve_citation", description: "Fetch verified citation details for a chunk.", inputSchema: { type: "object", properties: { chunk_id: { type: "string" } }, required: ["chunk_id"] } },
  { name: "evaluate_compliance_checklist", description: "Evaluate a configured compliance framework.", inputSchema: { type: "object", properties: { framework_id: { type: "string" }, doc_id_filter: { type: "string" } }, required: ["framework_id"] } },
  { name: "perform_gap_analysis", description: "Analyze a compliance requirement against indexed evidence.", inputSchema: { type: "object", properties: { requirement_id: { type: "string" }, title: { type: "string" }, requirement_text: { type: "string" }, category: { type: "string" } }, required: ["requirement_id", "title", "requirement_text"] } },
  { name: "generate_knowledge_wiki_entry", description: "Create or update an Obsidian-style vault note.", inputSchema: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, note_type: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["title", "content"] } },
  { name: "query_knowledge_graph", description: "Return vault nodes and wikilink edges.", inputSchema: { type: "object", properties: {} } },
  { name: "list_documents", description: "List indexed documents.", inputSchema: { type: "object", properties: {} } },
  { name: "export_audit_report", description: "Export a compliance audit report as Markdown or JSON.", inputSchema: { type: "object", properties: { framework_id: { type: "string" }, format: { type: "string", enum: ["markdown", "json"], default: "markdown" } }, required: ["framework_id"] } }
];
app.get("/api/mcp/tools", (_req, res) => res.json(tools));
function evaluate(frameworkId: string): any {
  const fw = frameworks().find(x => x.id === frameworkId);
  if (!fw) throw new Error(`Framework not found: ${frameworkId}`);
  const findings = fw.items.map((item: any) => { const matches = searchChunks(`${item.title} ${item.requirement}`, 2); const status = matches.length ? (matches[0].content.length > 180 ? "COVERED" : "PARTIALLY_COVERED") : "MISSING"; return { id: item.id, title: item.title, category: item.category, requirement: item.requirement, status, confidence: matches.length ? 0.75 : 0.1, evidence: matches.map(c => ({ chunk_id: c.chunk_id, doc_title: c.doc_title, section: c.section, page_number: c.page_number, relevance_score: 0.75, verbatim_excerpt: c.content.slice(0, 300) })), gaps: status === "MISSING" ? ["No matching evidence was found in the indexed documents."] : [], remediation: status === "MISSING" ? "Create and publish a policy covering this requirement." : "Review evidence and maintain periodic testing." }; });
  const covered = findings.filter((x: any) => x.status === "COVERED").length, partial = findings.filter((x: any) => x.status === "PARTIALLY_COVERED").length;
  return { framework_id: fw.id, framework_name: fw.name, total_requirements: findings.length, covered, partially_covered: partial, missing: findings.length - covered - partial, compliance_score: Math.round((covered + partial * 0.5) / findings.length * 100), findings };
}
function callTool(name: string, args: any): any {
  if (name === "search_documents") { const results = searchChunks(String(args.query || ""), Math.min(Number(args.top_k || 4), 50)).filter(c => !args.doc_id_filter || c.doc_id === args.doc_id_filter); return { success: true, results, count: results.length }; }
  if (name === "retrieve_citation") { const row = db.prepare("SELECT c.chunk_id,c.doc_id,d.title AS doc_title,c.section,c.page_number,c.content FROM chunks c JOIN documents d ON d.doc_id=c.doc_id WHERE c.chunk_id=?").get(String(args.chunk_id || "")); return row ? { success: true, citation: row } : { success: false, error: `Chunk ${args.chunk_id} not found` }; }
  if (name === "evaluate_compliance_checklist") return { success: true, report: evaluate(String(args.framework_id || "")) };
  if (name === "perform_gap_analysis") { const results = searchChunks(`${args.title || ""} ${args.requirement_text || ""}`, 2); const status = results.length ? (results[0].content.length > 180 ? "COVERED" : "PARTIALLY_COVERED") : "MISSING"; return { success: true, finding: { id: args.requirement_id, title: args.title, category: args.category || "General", requirement: args.requirement_text, status, confidence: results.length ? 0.75 : 0.1, evidence: results.map(c => ({ chunk_id: c.chunk_id, doc_title: c.doc_title, section: c.section, page_number: c.page_number, relevance_score: 0.75, verbatim_excerpt: c.content.slice(0, 300) })), gaps: status === "MISSING" ? ["No matching evidence was found."] : [], remediation: status === "MISSING" ? "Create and publish a policy covering this requirement." : "Review evidence and maintain periodic testing." } }; }
  if (name === "generate_knowledge_wiki_entry") { const slug = String(args.title || "note").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); db.prepare("INSERT OR REPLACE INTO vault_notes VALUES (?, ?, ?, ?, ?)").run(slug, args.title, args.note_type || "entity", JSON.stringify(args.tags || []), args.content); return { success: true, slug, vault_path: `${slug}.md` }; }
  if (name === "query_knowledge_graph") return { success: true, graph: graph() };
  if (name === "list_documents") { const documents = db.prepare("SELECT d.doc_id,d.title,d.filename,d.created_at,COUNT(c.chunk_id) AS chunk_count FROM documents d LEFT JOIN chunks c ON c.doc_id=d.doc_id GROUP BY d.doc_id").all(); return { success: true, documents, total: documents.length }; }
  if (name === "export_audit_report") { const report = evaluate(String(args.framework_id || "")); if (args.format === "json") return { success: true, content: report }; const lines = [`# Compliance Audit Report: ${report.framework_name}`, `**Compliance Score:** ${report.compliance_score}%`, "", "## Control Evaluation Matrix", ""]; report.findings.forEach((f: any) => lines.push(`### ${f.id} - ${f.title} [${f.status}]`, `**Requirement:** ${f.requirement}`, f.evidence.length ? `**Evidence:** ${f.evidence.map((e: any) => `> "${e.verbatim_excerpt}"`).join("\n")}` : "", `**Remediation:** ${f.remediation}`, "")); return { success: true, markdown: lines.join("\n") }; }
  return { success: false, error: `Unknown tool: ${name}` };
}
app.post("/api/mcp/call", (req, res) => { try { res.json(callTool(String(req.body?.name || ""), req.body?.arguments || {})); } catch (e) { res.status(400).json({ success: false, error: (e as Error).message }); } });
app.post("/mcp", (req, res) => {
  const body = req.body || {}; const id = body.id ?? null;
  try {
    if (body.method === "initialize") return res.json({ jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "vegah-compliance", version: "1.0.0" } } });
    if (body.method === "notifications/initialized") return res.status(202).end();
    if (body.method === "tools/list") return res.json({ jsonrpc: "2.0", id, result: { tools } });
    if (body.method === "tools/call") { const result = callTool(body.params?.name, body.params?.arguments || {}); return res.json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result) }], isError: result.success === false } }); }
    return res.status(400).json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${body.method}` } });
  } catch (e) { return res.status(400).json({ jsonrpc: "2.0", id, error: { code: -32000, message: (e as Error).message } }); }
});
app.post("/api/chat", (req, res) => { const query = String(req.body?.query || "").trim(); if (!query) return res.status(400).json({ detail: "query is required" }); const started = Date.now(); const hits = searchChunks(query); const answer = hits.length ? `Based on the indexed documents:\n\n${hits.map(h => h.content).join("\n\n")}` : "No indexed evidence matched your question. Upload a policy document or ask about the available compliance frameworks."; res.json({ query, answer, provider: "autonomous_fallback", cost: "0", latency_ms: Date.now() - started, trace: [{ step: 1, phase: "retrieval", strategy: "SQLite FTS5", duration_ms: Date.now() - started, status: "completed" }], context: { matched_chunks: hits.length }, citations: hits.map(h => ({ chunk_id: h.chunk_id, doc_title: h.doc_title, section: h.section, page_number: h.page_number, score: 0.75, content: h.content, verbatim_excerpt: h.content.slice(0, 300) })) }); });
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => res.status(400).json({ detail: err.message }));
seedSampleDocuments()
  .then(() => {
    app.listen(port, "0.0.0.0", () => console.log(`Vegah Node backend listening on http://127.0.0.1:${port}`));
  })
  .catch(error => {
    console.error("Failed to index sample documents:", error);
    process.exitCode = 1;
  });
