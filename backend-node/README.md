# Vegah Node backend

This TypeScript/Express service preserves the frontend API contract without requiring API keys. It stores documents, chunks, FTS indexes, and vault notes in `data/vegah.db`.

```powershell
cd backend-node
npm install
npm run build
npm start
```

The service listens on port `8000` by default. Set `PORT` or `NODE_DB_PATH` to override defaults. Uploads accept PDF, DOCX, Markdown, and text files.

MCP is available through the frontend-compatible `/api/mcp/tools` and
`/api/mcp/call` routes, plus a JSON-RPC HTTP endpoint at `/mcp`. The latter
supports `initialize`, `tools/list`, and `tools/call` for all eight tools:
`search_documents`, `retrieve_citation`, `evaluate_compliance_checklist`,
`perform_gap_analysis`, `generate_knowledge_wiki_entry`,
`query_knowledge_graph`, `list_documents`, and `export_audit_report`.
