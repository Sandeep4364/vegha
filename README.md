# VEGAH — Enterprise Document Intelligence & Compliance Agent

> MCP-powered agentic system for enterprise document Q&A, compliance audit, and knowledge graph — built under real cost constraints.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────┐      ┌──────────────────────────────────────────────┐
│   Next.js Frontend      │      │              Node.js TypeScript Backend       │
│   (React 18 + Tailwind) │      │                                              │
│                         │      │  ┌──────────────────────────────────────┐     │
│  • Agent Chat UI        │◄────►│  │  Agent Orchestrator (OpenClaw/       │     │
│  • Compliance Audit     │ REST │  │  Hermes/Jarvis patterns)             │     │
│  • Knowledge Vault      │      │  │    ↓                                 │     │
│  • Document Manager     │      │  │  MCP Server (8 tools)                │     │
│                         │      │  │    ↓          ↓          ↓           │     │
│                         │      │  │  VectorStore  WikiVault  Compliance  │     │
│                         │      │  │  (Supabase+FTS) (Obsidian) Engine    │     │
│                         │      │  └──────────────────────────────────────┘     │
│                         │      │                                              │
│                         │      │  Local deterministic synthesis engine        │
│                         │      │  (zero API keys or network calls required)   │
└─────────────────────────┘      └──────────────────────────────────────────────┘
```

---

## 📋 MCP Tools (Model Context Protocol)

The system exposes **8 MCP tools** that the agent can call during reasoning:

| Tool | Description |
|------|-------------|
| `search_documents` | Hybrid (BM25 + dense embedding) search over indexed documents |
| `retrieve_citation` | Retrieve a specific chunk by ID for verbatim citation |
| `evaluate_compliance_checklist` | Run full framework evaluation (SOC2, ISO27001) |
| `perform_gap_analysis` | Analyze a single requirement for coverage gaps |
| `generate_knowledge_wiki_entry` | Create/update Obsidian-style wiki notes |
| `query_knowledge_graph` | Traverse the wiki backlink graph |
| `list_documents` | List all indexed documents and chunk counts |
| `export_audit_report` | Export compliance findings as structured report |

---

## 🤖 Agent Design — Orchestration Patterns

The agent uses a **3-phase orchestration** inspired by:

### Phase 1: Planning (OpenClaw pattern)
- Analyzes user query intent (compliance vs. Q&A)
- Decomposes into MCP tool-calling plan
- Determines which tools to call and in what order

### Phase 2: Tool Execution (Hermes pattern)
- Executes MCP tool calls with structured arguments
- Chains tool outputs for multi-step reasoning
- Verifies citations against source chunks

### Phase 3: Synthesis (Jarvis pattern)
- Synthesizes final answer from tool outputs
- Formats response with embedded source citations
- Syncs findings to Obsidian wiki vault
- Returns full execution trace for transparency

---

## 📝 Obsidian / Wiki-Style Knowledge Graph

The system builds an **Obsidian-compatible knowledge vault**:

- **Markdown notes** with YAML frontmatter (title, type, tags, timestamps)
- **`[[wikilinks]]`** for bidirectional linking between notes
- **Backlink graph** generated from persisted `[[wikilinks]]` for traversal
- **Auto-generated notes** from:
  - Ingested documents (policy summaries)
  - Compliance findings (per-control evidence + gaps)
  - Agent interactions (knowledge entries)

### Graph Structure
```
[Policy Document] ──links-to──► [Compliance Finding]
       ↑                              │
       └──────── backlinks ◄──────────┘
                     │
                     ▼
            [Knowledge Entry]
```

Notes are persisted in the Supabase `vault_notes` table and use
Obsidian-compatible Markdown content.

---

## 💰 Cost Approach — Near-Zero Budget

| Component | Solution | Cost |
|-----------|----------|------|
| **Retrieval** | Postgres full-text search over indexed chunks (Supabase) | **$0** — no vector DB |
| **Answer synthesis** | Deterministic citation-based local synthesis | **$0** — no API key |
| **Storage** | Supabase (Postgres) for documents, chunks, and vault notes | **$0** |
| **Knowledge Graph** | Supabase vault notes + `[[wikilinks]]` | **$0** |
| **Frontend** | Static Next.js export or Vercel free tier | **$0** |

**Total ongoing cost: $0/month** under normal usage patterns.

The system runs fully autonomously with zero API calls. Answers are generated from
retrieved document evidence and compliance findings; external model credentials
are not required.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+

### Backend Setup
```bash
cd backend-node
npm install
npm run build
npm start
```

On startup, the backend automatically indexes supported files from
`sample_documents/` into Supabase. Existing filenames are skipped, so restarting
the service does not create duplicate document records.

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

For a deployed frontend, set `NEXT_PUBLIC_API_URL` to the public URL of the
running Node backend. If the frontend server should proxy `/api/*` requests,
also set `BACKEND_URL` to that same backend URL before building.

---

## 📁 Project Structure

```
Vegah/
├── backend-node/
│   ├── src/
│   │   ├── db.ts               # Supabase persistence and full-text retrieval
│   │   ├── ingest.ts           # PDF/DOCX/MD/TXT extraction and chunking
│   │   └── server.ts           # Express API and MCP tools
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx        # Main UI (4-tab SPA)
│   │   │   ├── layout.tsx      # Root layout
│   │   │   └── globals.css     # Tailwind + custom styles
│   │   └── lib/
│   │       └── api.ts          # TypeScript API client
│   ├── next.config.js          # API proxy rewrites
│   ├── tailwind.config.js
│   └── package.json
├── sample_documents/           # Enterprise sample docs
│   ├── SOC2_Information_Security_Policy.md
│   ├── Incident_Response_Plan_SOP.md
│   ├── Access_Control_and_Key_Management_Runbook.md
│   ├── Data_Retention_and_Privacy_Policy.md
│   └── compliance_frameworks/
│       ├── SOC2_Type_II_Checklist.json
│       └── ISO27001_2022_Checklist.json
├── .gitignore
└── README.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Agent chat with MCP tool orchestration |
| `POST` | `/api/documents/upload` | Upload & ingest a document |
| `GET` | `/api/documents` | List indexed documents |
| `GET` | `/api/compliance/frameworks` | List available compliance frameworks |
| `GET` | `/api/compliance/evaluate/{id}` | Run compliance evaluation |
| `POST` | `/api/compliance/gap-analysis` | Single-requirement gap analysis |
| `GET` | `/api/vault/notes` | List Obsidian wiki notes |
| `GET` | `/api/vault/notes/{slug}` | Get note with backlinks |
| `GET` | `/api/vault/graph` | Knowledge graph (nodes + links) |
| `GET` | `/api/mcp/tools` | List MCP tool definitions |
| `POST` | `/api/mcp/call` | Direct MCP tool invocation |

Uploaded files are validated (PDF, DOCX, Markdown, or TXT), limited to
25 MB by default, and indexed into Supabase. The database stores document
metadata, extracted chunks with a full-text search index, and vault notes so
the index survives backend restarts.
| `POST` | `/mcp/` | Standards-compliant MCP v2 Streamable HTTP transport |

The MCP transport responds to JSON-RPC `initialize`, `tools/list`, and `tools/call`
requests. The web application uses the REST routes above, while external MCP
clients can connect directly to `http://127.0.0.1:8000/mcp/`.

### Demo walkthrough

1. Start the backend, then the frontend and open `http://localhost:3000`.
2. In **Agent Chat**, ask about encryption or MFA and expand the source citations and agent trace.
3. In **Compliance Audit**, run the SOC 2 Type II checklist and expand a finding to show evidence and remediation.
4. In **Knowledge Vault**, open a generated note and switch to Graph view.
5. In **Documents**, upload a PDF, DOCX, Markdown, or text file and refresh the index.

---

## 🎯 Key Design Decisions

1. **Hybrid Retrieval**: BM25 lexical + dense cosine similarity merged via Reciprocal Rank Fusion — better recall than either alone.
2. **No Vector DB dependency**: Supabase Postgres full-text search eliminates Pinecone/Weaviate/Chroma costs and complexity.
3. **Local synthesis**: The system produces useful structured answers from retrieval results alone, without API keys or external model calls.
4. **Real MCP Protocol**: Tools are defined with JSON schemas, the agent plans and calls them in loops — not a single LLM wrapper.
5. **Obsidian-compatible output**: Wiki vault notes are real `.md` files with YAML frontmatter that open in Obsidian.

---

## 📜 License

Confidential — VEGAH internal evaluation only.
# vegha
# vegha
