import { useEffect, useMemo, useState } from 'react'
import { KnowledgeBaseContext } from './KnowledgeBaseContext.js'
import {
  deleteKnowledgeBaseDocument,
  listKnowledgeBaseDocuments,
} from '../api/files'

function KnowledgeBaseProvider({ children }) {
  const [folders, setFolders] = useState([])
  const [documents, setDocuments] = useState([])
  const [storageError, setStorageError] = useState('')

  useEffect(() => {
    let isMounted = true
    listKnowledgeBaseDocuments()
      .then((records) => {
        if (isMounted) {
          const foldersById = new Map()
          records.forEach(({ folderId, folderName }) => {
            if (folderId && folderName) foldersById.set(folderId, folderName)
          })
          setFolders(
            Array.from(foldersById, ([id, name]) => ({
              id,
              name,
              createdAt: '',
            })),
          )
          setDocuments(
            records.map((document) => ({
              ...document,
              extension: document.name.split('.').pop()?.toLowerCase() ?? '',
              status: document.status || (document.chunks?.length ? 'ready' : 'stored'),
              progress: document.status === 'ready' || document.chunks?.length ? 100 : (document.progress || 0),
              chunks: Array.isArray(document.chunks) ? document.chunks : [],
              chunkCount: document.chunkCount ?? (Array.isArray(document.chunks) ? document.chunks.length : 0),
              pageCount: document.pageCount ?? 0,
              error: document.error || '',
              storageId: document.id,
            })),
          )
        }
      })
      .catch((error) => {
        if (isMounted) setStorageError(error.message)
      })
    return () => {
      isMounted = false
    }
  }, [])

  const value = useMemo(
    () => ({
      folders,
      documents,
      storageError,
      async refreshDocuments() {
        try {
          const records = await listKnowledgeBaseDocuments()
          setDocuments((currentDocuments) => {
            const recordMap = new Map(records.map((rec) => [rec.id, rec]))
            const updated = currentDocuments.map((doc) => {
              const serverDoc = recordMap.get(doc.storageId || doc.id)
              if (!serverDoc) return doc
              recordMap.delete(doc.storageId || doc.id)
              return {
                ...doc,
                ...serverDoc,
                id: doc.id,
                storageId: serverDoc.id,
                extension: serverDoc.name?.split('.').pop()?.toLowerCase() ?? doc.extension,
                status: serverDoc.status || (serverDoc.chunks?.length ? 'ready' : 'stored'),
                progress: serverDoc.status === 'ready' || serverDoc.chunks?.length ? 100 : (serverDoc.progress || 0),
                chunks: Array.isArray(serverDoc.chunks) && serverDoc.chunks.length > 0 ? serverDoc.chunks : doc.chunks,
                chunkCount: serverDoc.chunkCount ?? (Array.isArray(serverDoc.chunks) ? serverDoc.chunks.length : doc.chunkCount ?? 0),
                pageCount: serverDoc.pageCount ?? doc.pageCount ?? 0,
                error: serverDoc.error || '',
              }
            })

            const newDocs = Array.from(recordMap.values()).map((serverDoc) => ({
              ...serverDoc,
              storageId: serverDoc.id,
              extension: serverDoc.name?.split('.').pop()?.toLowerCase() ?? '',
              status: serverDoc.status || (serverDoc.chunks?.length ? 'ready' : 'stored'),
              progress: serverDoc.status === 'ready' || serverDoc.chunks?.length ? 100 : (serverDoc.progress || 0),
              chunks: Array.isArray(serverDoc.chunks) ? serverDoc.chunks : [],
              chunkCount: serverDoc.chunkCount ?? (Array.isArray(serverDoc.chunks) ? serverDoc.chunks.length : 0),
              pageCount: serverDoc.pageCount ?? 0,
              error: serverDoc.error || '',
            }))

            return [...newDocs, ...updated]
          })
        } catch {
          // ignore
        }
      },
      addFolder(folder) {
        setFolders((currentFolders) => [...currentFolders, folder])
      },
      clearStorageError() {
        setStorageError('')
      },
      addDocuments(newDocuments) {
        setDocuments((currentDocuments) => [...newDocuments, ...currentDocuments])
      },
      updateDocument(documentId, update) {
        setDocuments((currentDocuments) =>
          currentDocuments.map((document) =>
            document.id === documentId || document.storageId === documentId
              ? { ...document, ...update }
              : document,
          ),
        )
      },
      async removeDocument(documentId) {
        const document = documents.find((item) => item.id === documentId)
        if (document?.path) {
          await deleteKnowledgeBaseDocument(document.storageId ?? document.id)
        }
        setDocuments((currentDocuments) =>
          currentDocuments.filter((document) => document.id !== documentId),
        )
      },
    }),
    [documents, folders, storageError],
  )

  return (
    <KnowledgeBaseContext.Provider value={value}>
      {children}
    </KnowledgeBaseContext.Provider>
  )
}

export default KnowledgeBaseProvider
