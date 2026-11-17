import { api } from "./api";

/**
 * POST /insights/upload-pyqs (multipart: file [+ num_clusters])
 * POST /insights/cluster      (json: { questions, num_clusters })
 * Both return ClusterAnalysisResponse:
 *   { total_questions_analyzed, clusters: [...], plotly_chart_json, scatter_chart_json }
 */
export async function uploadPyqs(file, numClusters, { onProgress, signal } = {}) {
  const form = new FormData();
  form.append("file", file, file.name);
  if (numClusters != null) form.append("num_clusters", String(numClusters));
  const { data } = await api.post("/insights/upload-pyqs", form, {
    timeout: 300_000,
    signal,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return normalizeAnalysis(data);
}

export async function clusterQuestions(questions, numClusters, { signal } = {}) {
  const { data } = await api.post(
    "/insights/cluster",
    { questions, num_clusters: numClusters ?? null },
    { timeout: 180_000, signal }
  );
  return normalizeAnalysis(data);
}

/* -------------------------------------------------------------------------- */
/* Plotly JSON -> plain arrays                                                 */
/* -------------------------------------------------------------------------- */

const TYPED = {
  i1: Int8Array, u1: Uint8Array, i2: Int16Array, u2: Uint16Array,
  i4: Int32Array, u4: Uint32Array, f4: Float32Array, f8: Float64Array,
};

/**
 * Plotly >= 6 serialises numpy arrays as {dtype, bdata} (base64) instead of plain
 * lists. Accept both so the charts work regardless of the installed plotly version.
 */
export function decodePlotlyArray(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && typeof value.bdata === "string" && value.dtype) {
    const Ctor = TYPED[value.dtype];
    if (!Ctor) return [];
    const bin = atob(value.bdata);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return Array.from(new Ctor(bytes.buffer));
  }
  return [];
}

/**
 * Turn the API response into what the UI needs:
 *  - clusters (already sorted by frequency by the backend)
 *  - bar: one row per cluster, from the response's `clusters`
 *  - scatter: one series per trace of `scatter_chart_json`, points decoded from Plotly
 *  - each cluster gets `questionPreviews`: every question in that cluster, taken from
 *    the scatter hover text (the backend only returns three full sample questions;
 *    previews are truncated to ~100 characters by the backend).
 */
export function normalizeAnalysis(raw) {
  const clusters = (raw?.clusters ?? []).map((c) => ({ ...c }));

  const traces = raw?.scatter_chart_json?.data ?? [];
  const scatter = traces
    .map((t) => {
      const xs = decodePlotlyArray(t.x);
      const ys = decodePlotlyArray(t.y);
      const hover = Array.isArray(t.hovertext) ? t.hovertext : [];
      return {
        name: t.name,
        points: xs.map((x, i) => ({ x, y: ys[i], preview: hover[i] ?? "" })),
      };
    })
    .filter((s) => s.points.length > 0);

  // Match scatter traces to clusters by topic label (plotly groups by that label).
  const byLabel = new Map(scatter.map((s) => [s.name, s]));
  for (const c of clusters) {
    const s = byLabel.get(c.topic_label);
    c.questionPreviews = s ? s.points.map((p) => p.preview).filter(Boolean) : [];
  }

  const average = clusters.length ? clusters.reduce((a, c) => a + c.question_count, 0) / clusters.length : 0;
  const bar = clusters.map((c, rank) => ({
    id: c.cluster_id,
    label: c.topic_label,
    count: c.question_count,
    percentage: c.percentage,
    keywords: c.keywords,
    rank,
    aboveAverage: c.question_count > average,
  }));

  return {
    totalQuestions: raw?.total_questions_analyzed ?? 0,
    clusters,
    bar,
    scatter,
    topCluster: clusters[0] ?? null,
  };
}
