import { api } from "./api";

/** GET /rag/status -> { chunks_indexed: number, ready: boolean } */
export async function getRagStatus() {
  const { data } = await api.get("/rag/status", { timeout: 8000 });
  return { chunks: data.chunks_indexed ?? 0, ready: Boolean(data.ready) };
}

/**
 * POST /rag/upload (multipart/form-data, field name "file")
 * -> { filename, total_pages, chunks_indexed, message }
 *
 * Do not set Content-Type by hand: the browser must add the multipart boundary.
 * `onProgress(percent)` reports the upload only; indexing then happens server-side.
 */
export async function uploadPdf(file, { onProgress, signal } = {}) {
  const form = new FormData();
  form.append("file", file, file.name);
  const { data } = await api.post("/rag/upload", form, {
    timeout: 300_000, // embedding a large PDF on CPU can be slow
    signal,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data;
}

/**
 * POST /rag/query { query, top_k }
 * -> { answer, citations: [{ source_file, page_number, snippet }], found_in_notes, fallback_message }
 */
export async function queryNotes(query, topK = 3, { signal } = {}) {
  const { data } = await api.post("/rag/query", { query, top_k: topK }, { timeout: 90_000, signal });
  return data;
}

/** POST /rag/reset -> { message } */
export async function resetRag() {
  const { data } = await api.post("/rag/reset", null, { timeout: 10_000 });
  return data;
}
