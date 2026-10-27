import {
  MAX_FILE_SIZE,
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_EXTENSIONS,
  SUPPORTED_IMAGE_EXTENSIONS,
  extractText,
  getExtension,
  splitIntoChunks,
} from '../utils/kbExtraction'
import { getKnowledgeBaseDocument, uploadKnowledgeBaseDocument } from '../api/files'

export function useKbUploader({ activeFolder, addDocuments, updateDocument, setNotice }) {
  async function processDocument(documentId, file, storageId) {
    const ext = getExtension(file.name)
    const isImageOrAudio =
      SUPPORTED_IMAGE_EXTENSIONS.has(ext) ||
      SUPPORTED_AUDIO_EXTENSIONS.has(ext) ||
      ext === 'docx' ||
      ext === 'doc'

    // Fast client-side text preview for non-binary formats
    if (!isImageOrAudio) {
      try {
        updateDocument(documentId, { status: 'extracting', progress: 15 })
        const text = await extractText(file, (progress) => {
          updateDocument(documentId, {
            status: 'extracting',
            progress: Math.min(40, progress),
          })
        })
        if (text && text.trim()) {
          const previewChunks = splitIntoChunks(text.trim())
          if (previewChunks.length > 0) {
            updateDocument(documentId, {
              status: 'chunking',
              progress: 55,
              chunkCount: previewChunks.length,
              chunks: previewChunks.map((content, index) => ({
                id: `${documentId}-${index + 1}`,
                index: index + 1,
                content,
                characters: content.length,
              })),
            })
          }
        }
      } catch {
        // Continue to server polling
      }
    }

    // Poll backend OCR, chunking & pgvector extraction pipeline
    const targetId = storageId || documentId
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      try {
        const doc = await getKnowledgeBaseDocument(targetId)
        if (doc) {
          if (
            doc.status === 'ready' ||
            (Array.isArray(doc.chunks) &&
              doc.chunks.length > 0 &&
              doc.status !== 'chunking' &&
              doc.status !== 'extracting')
          ) {
            updateDocument(documentId, {
              status: 'ready',
              progress: 100,
              chunks: Array.isArray(doc.chunks) ? doc.chunks : [],
              chunkCount: doc.chunkCount ?? (Array.isArray(doc.chunks) ? doc.chunks.length : 0),
              error: '',
            })
            break
          } else if (doc.status === 'error' || doc.status === 'failed') {
            updateDocument(documentId, {
              status: 'error',
              progress: 0,
              error: doc.error || 'Extraction failed.',
            })
            break
          } else if (doc.status) {
            // Real-time live poll status update displayed in table
            updateDocument(documentId, {
              status: doc.status,
              progress: doc.progress ?? 0,
              chunkCount: doc.chunkCount ?? 0,
              pageCount: doc.pageCount ?? 0,
              error: '',
            })
          }
        }
      } catch {
        // Continue polling
      }
    }
  }

  function uploadFiles(fileList) {
    const files = Array.from(fileList)
    if (files.length === 0) return

    if (!activeFolder) {
      setNotice('Choose a folder before uploading documents.')
      return
    }

    const accepted = []
    const rejected = []

    for (const file of files) {
      const extension = getExtension(file.name)
      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        rejected.push(`${file.name}: unsupported file type`)
      } else if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}: file is larger than 20 MB`)
      } else {
        accepted.push(file)
      }
    }

    if (rejected.length > 0) {
      setNotice(
        `${rejected.join('; ')}. Supported formats: PDF, DOCX, Images, Audio, TXT, MD, CSV, JSON, HTML.`,
      )
    }

    const newDocuments = accepted.map((file) => {
      const docId = crypto.randomUUID()
      return {
        id: docId,
        storageId: docId,
        name: file.name,
        extension: getExtension(file.name),
        size: file.size,
        folderId: activeFolder.id,
        status: 'queued',
        progress: 0,
        chunks: [],
        chunkCount: 0,
        uploadedAt: new Date().toISOString(),
        error: '',
      }
    })

    if (newDocuments.length > 0) {
      addDocuments(newDocuments)
      newDocuments.forEach(async (document, index) => {
        const file = accepted[index]
        try {
          const storedDocument = await uploadKnowledgeBaseDocument(file, activeFolder)
          updateDocument(document.id, {
            ...storedDocument,
            id: storedDocument.id,
            storageId: storedDocument.id,
            extension: document.extension,
            status: storedDocument.status || 'queued',
            progress: storedDocument.status === 'ready' ? 100 : (storedDocument.progress || 0),
            chunks: Array.isArray(storedDocument.chunks) ? storedDocument.chunks : [],
            chunkCount: storedDocument.chunkCount || 0,
            error: '',
          })
          await processDocument(storedDocument.id, file, storedDocument.id)
        } catch (error) {
          updateDocument(document.id, {
            status: 'error',
            progress: 0,
            error: error.message,
          })
          setNotice(`${file.name}: ${error.message}`)
        }
      })
    }
  }

  return { uploadFiles }
}
