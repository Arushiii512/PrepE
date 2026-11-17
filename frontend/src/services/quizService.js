import { api } from "./api";

/**
 * POST /quiz/generate
 * body: { topic: string|null, use_indexed_notes: boolean, num_questions: 1-15, difficulty: "easy"|"medium"|"hard" }
 * -> { title, total_questions, questions: [{ id, question, options: [{ key, text }], correct_key, explanation, difficulty }] }
 */
export async function generateQuiz({ topic, useIndexedNotes, numQuestions, difficulty }, { signal } = {}) {
  const payload = {
    topic: topic && topic.trim() ? topic.trim() : null,
    use_indexed_notes: Boolean(useIndexedNotes),
    num_questions: numQuestions,
    difficulty,
  };
  // The backend retries Gemini up to 3 times, so allow plenty of time.
  const { data } = await api.post("/quiz/generate", payload, { timeout: 150_000, signal });
  return data;
}

/**
 * The backend silently substitutes a placeholder quiz when Gemini is unavailable or
 * every attempt fails validation (see generate_mock_quiz in quiz_engine.py). Its
 * questions all begin with "Sample Question N". We detect that so the UI can say so
 * instead of presenting placeholder content as a real quiz.
 */
export function looksLikeSampleQuiz(quiz) {
  const qs = quiz?.questions;
  return Array.isArray(qs) && qs.length > 0 && qs.every((q) => /^Sample Question \d+/i.test(q.question || ""));
}
