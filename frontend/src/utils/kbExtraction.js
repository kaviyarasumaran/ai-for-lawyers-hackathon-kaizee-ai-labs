/**
 * Utility functions for Knowledge Base text extraction, OCR, PDF parsing, and chunking.
 */
import { formatBytes } from './formatters'

export { formatBytes }

export const MAX_FILE_SIZE = 20 * 1024 * 1024
export const CHUNK_SIZE = 1200
export const CHUNK_OVERLAP = 150
export const DOCUMENTS_PER_PAGE = 5

export const SUPPORTED_TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json', 'html'])
export const SUPPORTED_DOC_EXTENSIONS = new Set(['pdf', 'doc', 'docx'])
export const SUPPORTED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'tiff', 'tif', 'bmp', 'heic'])
export const SUPPORTED_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac', 'webm', 'weba'])

export const SUPPORTED_EXTENSIONS = new Set([
  ...SUPPORTED_TEXT_EXTENSIONS,
  ...SUPPORTED_DOC_EXTENSIONS,
  ...SUPPORTED_IMAGE_EXTENSIONS,
  ...SUPPORTED_AUDIO_EXTENSIONS,
])

export function getExtension(filename) {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

export function splitIntoChunks(text) {
  const cleanedText = text.trim()
  if (!cleanedText) return []

  const chunks = []
  let start = 0

  while (start < cleanedText.length) {
    let end = Math.min(start + CHUNK_SIZE, cleanedText.length)
    if (end < cleanedText.length) {
      const boundary = cleanedText.lastIndexOf(' ', end)
      if (boundary > start + CHUNK_SIZE * 0.6) end = boundary
    }

    const content = cleanedText.slice(start, end).trim()
    if (content) chunks.push(content)
    if (end >= cleanedText.length) break
    start = Math.max(end - CHUNK_OVERLAP, start + 1)
  }

  return chunks
}

export async function extractPdfText(file, onProgress) {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  }).promise
  const pages = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(pageText)
    onProgress(Math.round((pageNumber / pdf.numPages) * 35))
  }

  return pages.join('\n\n')
}

export async function extractText(file, onProgress) {
  if (getExtension(file.name) === 'pdf') {
    return extractPdfText(file, onProgress)
  }

  onProgress(20)
  return file.text()
}
