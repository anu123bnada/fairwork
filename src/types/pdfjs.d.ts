// Minimal surface of pdf.js used by src/features/offer/pdf-text.ts (the package ships types
// only for its legacy entry point).
declare module "pdfjs-dist/build/pdf.mjs" {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(source: Record<string, unknown>): { promise: Promise<unknown>; destroy(): Promise<void> };
}
