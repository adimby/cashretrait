/**
 * pdfjs (Node, legacy build) runs a "fake worker" loaded by a dynamic import of a computed path
 * (`./pdf.worker.mjs`), which Vercel's file tracer cannot follow. Importing the worker with a static
 * specifier makes it traced and bundled; exposing it as `globalThis.pdfjsWorker` makes pdfjs use it
 * directly instead of importing workerSrc (the worker module sets it itself; we set it too in case it does not).
 */
let ready: Promise<void> | null = null

export function ensurePdfWorker(): Promise<void> {
  ready ??= import('pdfjs-dist/legacy/build/pdf.worker.mjs').then((worker) => {
    const g = globalThis as { pdfjsWorker?: unknown }
    g.pdfjsWorker ??= worker
  })
  return ready
}
