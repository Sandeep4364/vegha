# Vegah Node backend

This TypeScript/Express service preserves the frontend API contract and stores
documents, searchable chunks, and vault notes in Supabase Postgres.

```powershell
cd backend-node
npm install
npm run build
npm start
```

Before starting, configure `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` in the backend environment. Apply the migration in
`supabase/migrations/` to the Supabase project first. The service listens on
port `8000` by default; set `PORT` to override it. Uploads accept PDF, DOCX,
Markdown, and text files.

The frontend must point to this Express service, not directly to the Supabase
URL. Set `NEXT_PUBLIC_API_URL` to the public backend URL when deploying the
frontend. For a server-hosted Next.js deployment, `BACKEND_URL` can proxy the
frontend's `/api/*` requests to the same backend.

AI features are provider-agnostic and optional. Set `AI_PROVIDER` to `openai`,
`gemini`, or `ollama`, then configure the matching credentials and models in
`.env`. The backend uses provider embeddings for semantic retrieval and the
provider chat model for cited RAG answers. If the provider is unavailable or
`AI_PROVIDER=none`, it automatically uses Postgres full-text retrieval and
deterministic synthesis.

MCP is available through the frontend-compatible `/api/mcp/tools` and
`/api/mcp/call` routes, plus a JSON-RPC HTTP endpoint at `/mcp`. The latter
supports `initialize`, `tools/list`, and `tools/call` for all eight tools:
`search_documents`, `retrieve_citation`, `evaluate_compliance_checklist`,
`perform_gap_analysis`, `generate_knowledge_wiki_entry`,
`query_knowledge_graph`, `list_documents`, and `export_audit_report`.
