type Provider = "openai" | "gemini" | "ollama" | "none";

export interface AiStatus {
  provider: Provider;
  configured: boolean;
  embeddings: boolean;
  generation: boolean;
  model: string | null;
}

export interface AiChunk {
  doc_title: string;
  section: string;
  content: string;
}

const provider = (process.env.AI_PROVIDER || "none").toLowerCase() as Provider;
const openAiBase = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const ollamaBase = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
const model = process.env.AI_MODEL || (
  provider === "gemini" ? "gemini-embedding-001" :
  provider === "ollama" ? "nomic-embed-text" : "text-embedding-3-small"
);
const chatModel = process.env.AI_CHAT_MODEL || (
  provider === "gemini" ? "gemini-2.0-flash" :
  provider === "ollama" ? "llama3.2" : "gpt-4o-mini"
);

function key() {
  return process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || "";
}

export function getAiStatus(): AiStatus {
  const configured = ["openai", "gemini", "ollama"].includes(provider) &&
    (provider === "ollama" || Boolean(key()));
  return {
    provider: ["openai", "gemini", "ollama"].includes(provider) ? provider : "none",
    configured,
    embeddings: configured,
    generation: configured,
    model: configured ? (provider === "gemini" ? chatModel : provider === "ollama" ? chatModel : chatModel) : null,
  };
}

async function json<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.text();
  if (!response.ok) throw new Error(`AI provider request failed (${response.status}): ${body.slice(0, 300)}`);
  return JSON.parse(body) as T;
}

export async function embed(text: string): Promise<number[] | null> {
  if (!getAiStatus().configured) return null;
  if (provider === "ollama") {
    const body = await json<{ embedding: number[] }>(`${ollamaBase}/api/embeddings`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
    });
    return body.embedding;
  }
  if (provider === "gemini") {
    const body = await json<{ embedding?: { values?: number[] } }>(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${encodeURIComponent(key())}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: { parts: [{ text }] } }) }
    );
    return body.embedding?.values || null;
  }
  const body = await json<{ data: Array<{ embedding: number[] }> }>(`${openAiBase}/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key()}` },
    body: JSON.stringify({ model, input: text }),
  });
  return body.data[0]?.embedding || null;
}

export async function generateAnswer(query: string, chunks: AiChunk[]): Promise<string | null> {
  if (!getAiStatus().configured || !chunks.length) return null;
  const context = chunks.map((chunk, index) =>
    `[Source ${index + 1}: ${chunk.doc_title}, ${chunk.section}]\n${chunk.content}`
  ).join("\n\n");
  const prompt = `Answer the user's question using only the supplied evidence. If the evidence is insufficient, say so. Cite sources as [Source 1], [Source 2].\n\nEvidence:\n${context}\n\nQuestion: ${query}`;
  if (provider === "ollama") {
    const body = await json<{ message?: { content?: string } }>(`${ollamaBase}/api/chat`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: chatModel, stream: false, messages: [{ role: "user", content: prompt }] }),
    });
    return body.message?.content || null;
  }
  if (provider === "gemini") {
    const body = await json<{ candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }>(
      `https://generativelanguage.googleapis.com/v1beta/models/${chatModel}:generateContent?key=${encodeURIComponent(key())}`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    return body.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || null;
  }
  const body = await json<{ choices?: Array<{ message?: { content?: string } }> }>(`${openAiBase}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key()}` },
    body: JSON.stringify({ model: chatModel, temperature: 0.1, messages: [{ role: "user", content: prompt }] }),
  });
  return body.choices?.[0]?.message?.content || null;
}
