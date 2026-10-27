import { useEffect, useMemo, useRef, useState } from 'react'
import { CaseContext } from '../context/CaseContext'
import {
  createCaseRecord,
  deleteCaseRecord,
  listCases,
  updateCaseRecord,
} from '../api/cases'
import {
  deleteCaseDocument,
  deleteChatAttachment,
  listChatAttachments,
  uploadCaseDocument,
  uploadChatAttachment,
} from '../api/files'
import {
  fetchBackendConversationMessages,
  fetchBackendConversations,
  renameChatConversation,
} from '../api/chat'
import {
  createChat,
  defaultCase,
  loadSavedActiveChatId,
  loadSavedCaseMessages,
  loadSavedChats,
  mapBackendMessageToChat,
  saveActiveChatId,
  saveCaseMessages,
  saveChats,
} from '../store/chatStore'

function CaseProvider({ children }) {
  const initialCaseMessages = useMemo(() => loadSavedCaseMessages(), [])
  const [cases, setCases] = useState(() => [
    {
      ...defaultCase,
      messages: initialCaseMessages['default-chat'] ?? [],
    },
  ])
  const casesRef = useRef(cases)
  const [isCasesLoading, setIsCasesLoading] = useState(true)
  const [caseError, setCaseError] = useState('')
  const [teamMembers, setTeamMembers] = useState([])
  const [chats, setChats] = useState(() => loadSavedChats())
  const [activeChatId, setActiveChatId] = useState(() => {
    const initialChats = loadSavedChats()
    const savedActiveId = loadSavedActiveChatId(initialChats[0]?.id)
    return initialChats.some((c) => c.id === savedActiveId)
      ? savedActiveId
      : initialChats[0]?.id
  })
  const chatsRef = useRef(chats)

  useEffect(() => {
    casesRef.current = cases
  }, [cases])

  useEffect(() => {
    chatsRef.current = chats
    saveChats(chats)
  }, [chats])

  useEffect(() => {
    if (activeChatId) {
      saveActiveChatId(activeChatId)
    }
  }, [activeChatId])

  useEffect(() => {
    let isMounted = true
    Promise.all([listCases(), listChatAttachments()])
      .then(([records, chatAttachments]) => {
        if (!isMounted) return
        const savedMsgs = loadSavedCaseMessages()
        setCases([
          {
            ...defaultCase,
            documents: chatAttachments,
            messages: savedMsgs['default-chat'] ?? [],
          },
          ...records.map((record) => ({
            ...record,
            chatId: record.chatId ?? record.id,
            documents: record.documents ?? [],
            messages: savedMsgs[record.id] ?? [],
            isDefault: false,
          })),
        ])
      })
      .catch((error) => {
        if (isMounted) setCaseError(error.message)
      })
      .finally(() => {
        if (isMounted) setIsCasesLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  // Sync with backend conversations (if available)
  useEffect(() => {
    let isMounted = true
    fetchBackendConversations()
      .then(async (backendConvs) => {
        if (!isMounted || !Array.isArray(backendConvs) || backendConvs.length === 0) return

        for (const bConv of backendConvs) {
          if (bConv.case_id) continue

          setChats((currentChats) => {
            const existing = currentChats.find((c) => c.id === bConv.id)
            if (!existing) {
              const newChat = {
                id: bConv.id,
                title: bConv.title || 'Conversation',
                messages: [],
                parentId: null,
                pinned: Boolean(bConv.pinned),
                createdAt: bConv.created_at || new Date().toISOString(),
                lastActivityAt: bConv.updated_at || new Date().toISOString(),
              }
              return [...currentChats, newChat]
            }
            return currentChats
          })

          const msgRecords = await fetchBackendConversationMessages(bConv.id)
          if (isMounted && Array.isArray(msgRecords) && msgRecords.length > 0) {
            setChats((currentChats) =>
              currentChats.map((c) => {
                if (c.id === bConv.id && c.messages.length === 0) {
                  return {
                    ...c,
                    messages: msgRecords.map(mapBackendMessageToChat),
                  }
                }
                return c
              }),
            )
          }
        }
      })
      .catch(() => {
        // Backend conversations not available; local storage remains authoritative
      })

    return () => {
      isMounted = false
    }
  }, [])

  const value = useMemo(
    () => ({
      cases,
      isCasesLoading,
      caseError,
      clearCaseError() {
        setCaseError('')
      },
      teamMembers,
      inviteTeamMember({ email, role }) {
        const member = {
          id: crypto.randomUUID(),
          email: email.trim().toLowerCase(),
          role,
          status: 'Pending',
          caseAccess: [],
          invitedAt: new Date().toISOString(),
        }
        setTeamMembers((currentMembers) => [member, ...currentMembers])
        return member
      },
      updateTeamMemberRole(memberId, role) {
        setTeamMembers((currentMembers) =>
          currentMembers.map((member) =>
            member.id === memberId ? { ...member, role } : member,
          ),
        )
      },
      updateTeamMemberCaseAccess(memberId, caseId, hasAccess) {
        setTeamMembers((currentMembers) =>
          currentMembers.map((member) => {
            if (member.id !== memberId) return member
            const caseAccess = new Set(member.caseAccess)
            if (hasAccess) caseAccess.add(caseId)
            else caseAccess.delete(caseId)
            return { ...member, caseAccess: [...caseAccess] }
          }),
        )
      },
      removeTeamMember(memberId) {
        setTeamMembers((currentMembers) =>
          currentMembers.filter((member) => member.id !== memberId),
        )
      },
      chats,
      activeChatId,
      activeChat: chats.find((chat) => chat.id === activeChatId) ?? chats[0],
      createChat() {
        const chat = createChat()
        setChats((currentChats) => [chat, ...currentChats])
        setActiveChatId(chat.id)
        return chat
      },
      selectChat(chatId) {
        if (!chatId) return
        setChats((currentChats) => {
          if (!currentChats.some((c) => c.id === chatId)) {
            const newChat = createChat({ id: chatId })
            return [newChat, ...currentChats]
          }
          return currentChats
        })
        setActiveChatId(chatId)
      },
      toggleChatPinned(chatId) {
        setChats((currentChats) =>
          currentChats.map((chat) =>
            chat.id === chatId ? { ...chat, pinned: !chat.pinned } : chat,
          ),
        )
      },
      renameChat(chatId, newTitle) {
        const cleanTitle = (typeof newTitle === 'string' ? newTitle : '').trim()
        if (!chatId || !cleanTitle) return
        setChats((currentChats) =>
          currentChats.map((chat) =>
            chat.id === chatId ? { ...chat, title: cleanTitle } : chat,
          ),
        )
        renameChatConversation(chatId, cleanTitle).catch(() => {})
      },
      deleteChat(chatId) {
        const currentChats = chatsRef.current
        const idsToDelete = new Set([chatId])
        let foundChild = true

        while (foundChild) {
          foundChild = false
          currentChats.forEach((chat) => {
            if (chat.parentId && idsToDelete.has(chat.parentId) && !idsToDelete.has(chat.id)) {
              idsToDelete.add(chat.id)
              foundChild = true
            }
          })
        }

        const remainingChats = currentChats.filter((chat) => !idsToDelete.has(chat.id))
        const nextChats =
          remainingChats.length > 0
            ? remainingChats
            : [createChat()]

        setChats(nextChats)
        if (idsToDelete.has(activeChatId)) {
          const mostRecentChat = nextChats
            .slice()
            .sort((first, second) =>
              second.lastActivityAt.localeCompare(first.lastActivityAt),
            )[0]
          setActiveChatId(mostRecentChat.id)
        }
      },
      branchChat(chatId, messageIndex) {
        const sourceChat = chatsRef.current.find((chat) => chat.id === chatId)
        if (!sourceChat || messageIndex < 0 || messageIndex >= sourceChat.messages.length) {
          return null
        }

        const firstUserMessage = sourceChat.messages.find(
          (message) => message.role === 'user',
        )
        const title = firstUserMessage
          ? `Branch: ${firstUserMessage.content.slice(0, 42)}`
          : `Branch of ${sourceChat.title}`
        const chat = createChat({
          parentId: sourceChat.id,
          title: title.slice(0, 56),
          messages: sourceChat.messages.slice(0, messageIndex + 1),
        })
        setChats((currentChats) => [chat, ...currentChats])
        setActiveChatId(chat.id)
        return chat
      },
      addChatMessages(chatId, messages) {
        setChats((currentChats) => {
          const chatExists = currentChats.some((c) => c.id === chatId)
          if (!chatExists) {
            const firstUserMsg = messages.find((m) => m.role === 'user')
            const newChat = createChat({
              id: chatId,
              title: firstUserMsg ? firstUserMsg.content.slice(0, 56) : 'New chat',
              messages,
            })
            return [newChat, ...currentChats]
          }
          return currentChats.map((chat) => {
            if (chat.id !== chatId) return chat
            const firstUserMessage = messages.find(
              (message) => message.role === 'user',
            )
            return {
              ...chat,
              title:
                chat.title === 'New chat' && firstUserMessage
                  ? firstUserMessage.content.slice(0, 56)
                  : chat.title,
              messages: [...chat.messages, ...messages],
              lastActivityAt: new Date().toISOString(),
            }
          })
        })
      },
      async createCase({ title, matterType, parties, summary, files }) {
        const record = await createCaseRecord({
          title: title.trim(),
          matterType,
          parties: parties.trim(),
          summary: summary.trim(),
          status: 'Open',
        })
        const now = record.createdAt ?? new Date().toISOString()
        const newCase = {
          ...record,
          chatId: record.chatId ?? record.id,
          createdAt: now,
          lastActivityAt: record.lastActivityAt ?? now,
          documents: record.documents ?? [],
          messages: [],
          isDefault: false,
        }

        setCases((currentCases) => [newCase, ...currentCases])
        setCaseError('')
        const uploadedDocuments = []
        const failedFiles = []
        for (const file of Array.from(files ?? [])) {
          try {
            uploadedDocuments.push(
              await uploadCaseDocument(record.id, file, 'case-intake'),
            )
          } catch (error) {
            failedFiles.push(`${file.name}: ${error.message}`)
          }
        }
        if (uploadedDocuments.length > 0) {
          setCases((currentCases) =>
            currentCases.map((caseItem) =>
              caseItem.id === record.id
                ? { ...caseItem, documents: uploadedDocuments }
                : caseItem,
            ),
          )
        }
        if (failedFiles.length > 0) {
          setCaseError(
            `Case created, but some files could not be uploaded: ${failedFiles.join('; ')}`,
          )
        }
        return { ...newCase, documents: uploadedDocuments }
      },
      async updateCase(caseId, updates) {
        const record = await updateCaseRecord(caseId, updates)
        setCases((currentCases) =>
          currentCases.map((caseItem) =>
            caseItem.id === caseId
              ? {
                  ...caseItem,
                  ...record,
                  documents: caseItem.documents,
                  messages: caseItem.messages,
                  isDefault: false,
                }
              : caseItem,
          ),
        )
        setCaseError('')
        return record
      },
      async deleteCase(caseId) {
        await deleteCaseRecord(caseId)
        setCases((currentCases) => {
          const remaining = currentCases.filter((item) => item.id !== caseId)
          const allCaseMsgs = loadSavedCaseMessages()
          delete allCaseMsgs[caseId]
          saveCaseMessages(allCaseMsgs)
          return remaining
        })
        setCaseError('')
      },
      async addCaseFiles(caseId, files, source = 'upload') {
        const currentCase = casesRef.current.find((item) => item.id === caseId)
        if (!currentCase) throw new Error('The selected case is no longer available.')
        const upload = currentCase.isDefault
          ? (file, fileSource) => uploadChatAttachment(file, fileSource, activeChatId || 'default-chat')
          : (file, fileSource) => uploadCaseDocument(caseId, file, fileSource)
        const results = await Promise.allSettled(
          Array.from(files, (file) => upload(file, source)),
        )
        const attachments = results
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value)
        const errors = results
          .filter((result) => result.status === 'rejected')
          .map((result) => result.reason.message)
        setCases((currentCases) =>
          currentCases.map((caseItem) =>
            caseItem.id === caseId
              ? {
                  ...caseItem,
                  documents: [...attachments, ...caseItem.documents],
                  lastActivityAt: new Date().toISOString(),
                }
              : caseItem,
          ),
        )
        if (errors.length > 0) {
          throw new Error(
            `${attachments.length} file${attachments.length === 1 ? '' : 's'} uploaded; ${errors.join('; ')}`,
          )
        }
        return attachments
      },
      async removeCaseFile(caseId, fileId) {
        const currentCase = casesRef.current.find((item) => item.id === caseId)
        const file = currentCase?.documents.find((item) => item.id === fileId)
        if (!file) return
        if (currentCase.isDefault) await deleteChatAttachment(fileId, activeChatId || 'default-chat')
        else await deleteCaseDocument(caseId, fileId)

        setCases((currentCases) =>
          currentCases.map((caseItem) =>
            caseItem.id === caseId
              ? {
                  ...caseItem,
                  documents: caseItem.documents.filter(
                    (item) => item.id !== fileId,
                  ),
                }
              : caseItem,
          ),
        )
      },
      addCaseMessages(caseId, messages) {
        setCases((currentCases) => {
          const next = currentCases.map((caseItem) =>
            caseItem.id === caseId
              ? {
                  ...caseItem,
                  messages: [...caseItem.messages, ...messages],
                  lastActivityAt: new Date().toISOString(),
                }
              : caseItem,
          )
          const allCaseMsgs = loadSavedCaseMessages()
          allCaseMsgs[caseId] = [
            ...(allCaseMsgs[caseId] ?? []),
            ...messages,
          ]
          saveCaseMessages(allCaseMsgs)
          return next
        })
      },
    }),
    [activeChatId, caseError, cases, chats, isCasesLoading, teamMembers],
  )

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>
}

export default CaseProvider
