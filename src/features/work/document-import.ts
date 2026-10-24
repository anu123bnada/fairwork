export const MAX_DOCUMENT_BYTES = 16000;
export function importEvidenceText(name: string, mime: string, bytes: Uint8Array, sha256: string) {
  if (!/\.txt$/i.test(name) || (mime !== "" && mime !== "text/plain")) throw new Error("Choose a UTF-8 .txt document. PDF, Word and images are not supported by this importer.");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_DOCUMENT_BYTES) throw new Error("Choose a nonempty text document of at most 16,000 bytes.");
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("Document fingerprint could not be calculated.");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The document must use UTF-8 text encoding."); }
  if (!text.trim() || Array.from(text).some(char => { const code = char.charCodeAt(0); return code < 32 && ![9, 10, 13].includes(code); })) throw new Error("The document contains empty or unsupported binary content.");
  const filename = Array.from(name.split(/[\\/]/).at(-1)!).filter(char => { const code = char.charCodeAt(0); return code >= 32 && code !== 127 && !(code >= 8234 && code <= 8238) && !(code >= 8294 && code <= 8297); }).join("").slice(0, 80);
  const chunks: string[] = [];
  while (text.length) {
    let end = Math.min(1700, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1]!)) end--;
    chunks.push(text.slice(0, end)); text = text.slice(end);
  }
  return chunks.map((chunk, index) => `Imported excerpt ${index + 1}/${chunks.length}: ${filename}\nOriginal SHA-256: ${sha256}\nEditable transcription; original file not stored.\n\n${chunk}`);
}
