/**
 * OpenAI text-embedding-3-small (1536 dimensions)
 * Used for semantic search in party_embeddings and order_service_embeddings
 */

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

export async function generateEmbedding(text: string): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const trimmed = text.trim().slice(0, 8000); // API limit
  if (!trimmed) {
    throw new Error("Text cannot be empty");
  }

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: trimmed,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI embeddings failed: ${res.status}`);
  }

  const data = (await res.json()) as { data: { embedding: number[] }[] };
  const embedding = data.data?.[0]?.embedding;
  if (!embedding || embedding.length !== EMBEDDING_DIM) {
    throw new Error("Invalid embedding response");
  }
  return embedding;
}

/**
 * Generate embeddings for multiple texts in one API call (synchronous batch).
 * Use for semantic search with several query variants (original + typo corrections).
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OpenAI API key not configured");
  }

  const trimmed = texts
    .map((t) => (typeof t === "string" ? t.trim().slice(0, 8000) : ""))
    .filter(Boolean);
  if (trimmed.length === 0) {
    throw new Error("At least one non-empty text required");
  }

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: trimmed.length === 1 ? trimmed[0] : trimmed,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI embeddings failed: ${res.status}`);
  }

  const data = (await res.json()) as { data: { embedding: number[] }[] };
  const list = data.data ?? [];
  if (list.length !== trimmed.length) {
    throw new Error("Embedding count mismatch");
  }
  for (const item of list) {
    if (!item.embedding || item.embedding.length !== EMBEDDING_DIM) {
      throw new Error("Invalid embedding in response");
    }
  }
  return list.map((item) => item.embedding);
}
