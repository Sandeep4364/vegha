const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function request<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    throw new Error("Backend is not running. Start the Node.js backend on http://127.0.0.1:8000 and try again.");
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
      else if (typeof body?.message === "string") message = body.message;
    } catch {
      const text = await res.text();
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export interface Citation {
  chunk_id: string;
  doc_title: string;
  section: string;
  page_number: number;
  score?: number;
  content: string;
  verbatim_excerpt?: string;
}

export interface TraceStep {
  step: number;
  phase: string;
  tool?: string;
  intent?: string;
  strategy?: string;
  arguments?: any;
  duration_ms?: number;
  status?: string;
  chunk_id?: string;
  verified?: boolean;
  cost?: string;
  tokens?: number;
}

export interface ChatResponse {
  query: string;
  answer: string;
  provider: string;
  cost: string;
  latency_ms: number;
  trace: TraceStep[];
  context: any;
  citations: Citation[];
}

export interface DocumentItem {
  doc_id: string;
  title: string;
  filename: string;
  chunk_count: number;
  created_at: string;
}

export interface ComplianceFinding {
  id: string;
  title: string;
  category: string;
  requirement: string;
  status: "COVERED" | "PARTIALLY_COVERED" | "MISSING";
  confidence: number;
  evidence: Array<{
    chunk_id: string;
    doc_title: string;
    section: string;
    page_number: number;
    relevance_score: number;
    verbatim_excerpt: string;
  }>;
  gaps: string[];
  remediation: string;
}

export interface FrameworkReport {
  framework_id: string;
  framework_name: string;
  total_requirements: number;
  covered: number;
  partially_covered: number;
  missing: number;
  compliance_score: number;
  findings: ComplianceFinding[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  tags: string[];
  connections: number;
  val: number;
}

export interface GraphLink {
  source: string;
  target: string;
  label: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface VaultNote {
  slug: string;
  title: string;
  type: string;
  tags: string[];
  content?: string;
  backlinks?: Array<{ id: string; title: string }>;
  outgoing?: Array<{ id: string; title: string }>;
}

export async function chatWithAgent(query: string, forceCompliance: boolean = false): Promise<ChatResponse> {
  return request<ChatResponse>(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, force_compliance_check: forceCompliance })
  });
}

export async function fetchDocuments(): Promise<DocumentItem[]> {
  return request<DocumentItem[]>(`${API_BASE}/api/documents`);
}

export async function uploadDocument(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  return request(`${API_BASE}/api/documents/upload`, {
    method: "POST",
    body: formData
  });
}

export async function fetchFrameworks(): Promise<Array<{ id: string; name: string; count: number }>> {
  return request<Array<{ id: string; name: string; count: number }>>(`${API_BASE}/api/compliance/frameworks`);
}

export async function evaluateCompliance(frameworkId: string): Promise<FrameworkReport> {
  return request<FrameworkReport>(`${API_BASE}/api/compliance/evaluate/${frameworkId}`);
}

export async function fetchVaultNotes(): Promise<VaultNote[]> {
  return request<VaultNote[]>(`${API_BASE}/api/vault/notes`);
}

export async function fetchVaultNote(slug: string): Promise<VaultNote> {
  return request<VaultNote>(`${API_BASE}/api/vault/notes/${slug}`);
}

export async function fetchVaultGraph(): Promise<GraphData> {
  return request<GraphData>(`${API_BASE}/api/vault/graph`);
}

export async function fetchMcpTools(): Promise<any[]> {
  return request<any[]>(`${API_BASE}/api/mcp/tools`);
}
