PDF.js 5.6.205 (Mozilla, Apache-2.0), https://github.com/mozilla/pdf.js/releases/tag/v5.6.205
The npm pdfjs-dist build/pdf.worker.min.mjs and build/pdf.min.mjs are wrapped, in that order, in separate functions. Each terminal ES module export is removed and import.meta.url is replaced by document.baseURI. Upstream already assigns pdfjsWorker and pdfjsLib to globalThis. This lets the upstream in-process worker parse local bytes under file:// without fetching another module. No PDF JavaScript or external resources are evaluated.

JSZip 3.10.1, https://github.com/Stuk/jszip/tree/v3.10.1
Unmodified npm dist/jszip.min.js. Only word/document.xml is inflated for DOCX. Packaging licenses are adjacent.
