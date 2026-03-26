const SYSTEM_PREFIX =
  "You are an inline assistant embedded in the user's document. The user asked " +
  "a question while writing. Answer concisely — a few sentences, not paragraphs. " +
  "Match the tone of the document. If the question is simple, the answer should be short.\n\n" +
  "--- DOCUMENT ---\n";

const SYSTEM_SUFFIX = "\n--- END DOCUMENT ---\n\n";

export function buildPrompt(document: string, query: string): string {
  return SYSTEM_PREFIX + document + SYSTEM_SUFFIX + query;
}
