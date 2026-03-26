const SYSTEM_INSTRUCTION =
  "You are an inline assistant embedded in the user's document. The user asked " +
  "a question while writing. Answer concisely — a few sentences, not paragraphs. " +
  "Match the tone of the document. If the question is simple, the answer should be short.";

const DOCUMENT_PREFIX = "\n\n--- DOCUMENT ---\n";
const DOCUMENT_SUFFIX = "\n--- END DOCUMENT ---\n\n";

export function getSystemPrompt(): string {
  return SYSTEM_INSTRUCTION;
}

export function buildUserMessage(document: string, query: string): string {
  return DOCUMENT_PREFIX + document + DOCUMENT_SUFFIX + query;
}

/** @deprecated Use getSystemPrompt() + buildUserMessage() separately */
export function buildPrompt(document: string, query: string): string {
  return getSystemPrompt() + buildUserMessage(document, query);
}
