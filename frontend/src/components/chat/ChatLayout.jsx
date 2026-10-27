import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Snackbar, useTheme } from '@mui/material'
import { useNavigate, useParams } from '@tanstack/react-router'
import ChatComposer from './ChatComposer'
import ChatCameraDialog from './ChatCameraDialog'
import ChatFilesDialog from './ChatFilesDialog'
import ChatHistoryPanel from './ChatHistoryPanel'
import ChatHeader from './ChatHeader'
import ChatMessages from './ChatMessages'
import ChatSidebar from './ChatSidebar'
import ChatEmptyState from './ChatEmptyState'
import { useCases } from '../../hooks'
import { requestChatReply } from '../../api/chat'
import { deleteChatAttachment, listChatAttachments, uploadChatAttachment } from '../../api/files'

const EMPTY_ARRAY = []

function ChatLayout() {
  const isDark = useTheme().palette.mode === 'dark'
  const navigate = useNavigate()
  const {
    caseId: routeCaseId,
    chatId: routeChatId,
  } = useParams({ strict: false })
  const isCaseChat = Boolean(routeCaseId)
  const caseId = routeCaseId ?? 'default-chat'
  const {
    cases,
    isCasesLoading,
    teamMembers,
    chats,
    activeChatId,
    activeChat,
    addCaseFiles,
    removeCaseFile,
    addCaseMessages,
    addChatMessages,
    createChat,
    selectChat,
    toggleChatPinned,
    renameChat,
    deleteChat,
    branchChat,
  } = useCases()
  const currentCase = cases.find((caseItem) => caseItem.id === caseId)
  const currentChat = (routeChatId && !routeCaseId)
    ? (chats.find((chat) => chat.id === routeChatId) ?? activeChat ?? chats[0])
    : (activeChat ?? chats[0])
  const baseMessages = (routeCaseId ? currentCase?.messages : currentChat?.messages) ?? EMPTY_ARRAY
  const [streamingState, setStreamingState] = useState(null)
  const caseChatId = currentCase?.chatId ?? currentCase?.id
  const effectiveChatId = isCaseChat
    ? caseChatId
    : (routeChatId ?? currentChat?.id ?? activeChatId ?? 'default-chat')

  const [generalChatFiles, setGeneralChatFiles] = useState([])
  const [stagedFiles, setStagedFiles] = useState([])

  const prevEffectiveChatIdRef = useRef(effectiveChatId)
  if (prevEffectiveChatIdRef.current !== effectiveChatId) {
    prevEffectiveChatIdRef.current = effectiveChatId
    setStagedFiles([])
  }

  useEffect(() => {
    if (isCaseChat || !effectiveChatId) return
    let isMounted = true
    listChatAttachments(effectiveChatId)
      .then((files) => {
        if (isMounted) setGeneralChatFiles(Array.isArray(files) ? files : [])
      })
      .catch(() => {
        if (isMounted) setGeneralChatFiles([])
      })
    return () => {
      isMounted = false
    }
  }, [isCaseChat, effectiveChatId])

  const chatFiles = useMemo(() => {
    const map = new Map()
    const sourceFiles = isCaseChat
      ? [...(currentCase?.documents ?? []), ...generalChatFiles]
      : generalChatFiles
    for (const file of sourceFiles) {
      if (file && (file.id || file.name)) {
        map.set(file.id || file.name, file)
      }
    }
    for (const msg of baseMessages) {
      if (Array.isArray(msg?.attachments)) {
        for (const att of msg.attachments) {
          if (att && (att.id || att.name) && !map.has(att.id || att.name)) {
            map.set(att.id || att.name, att)
          }
        }
      }
    }
    for (const staged of stagedFiles) {
      if (staged && (staged.id || staged.name) && !map.has(staged.id || staged.name)) {
        map.set(staged.id || staged.name, staged)
      }
    }
    return Array.from(map.values())
  }, [isCaseChat, currentCase?.documents, generalChatFiles, baseMessages, stagedFiles])
  const visibleChats = isCaseChat
    ? currentCase
      ? [{
          id: caseChatId,
          title: currentCase.title,
          messages: currentCase.messages,
          pinned: false,
          createdAt: currentCase.createdAt,
          lastActivityAt: currentCase.lastActivityAt,
        }]
      : []
    : chats
  const [isFilesOpen, setIsFilesOpen] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false)
  const [typingConversationIds, setTypingConversationIds] = useState([])
  const conversationId = routeCaseId
    ? routeChatId ?? currentCase?.chatId ?? caseId
    : routeChatId ?? activeChatId
  const streamingMessage =
    streamingState?.conversationId === conversationId
      ? streamingState.message
      : null
  const messages = streamingMessage ? [...baseMessages, streamingMessage] : baseMessages
  const isTyping = typingConversationIds.includes(conversationId)
  const isAssistantTyping = isTyping && (!streamingMessage || !streamingMessage.content)

  useEffect(() => {
    if (!routeCaseId && routeChatId) {
      selectChat(routeChatId)
      return
    }
    if (routeCaseId && !isCasesLoading && !currentCase) {
      navigate({ to: '/cases', replace: true })
      return
    }
    if (routeCaseId && currentCase && !routeChatId) {
      navigate({
        to: '/cases/$caseId/chat/$chatId',
        params: {
          caseId: currentCase.id,
          chatId: currentCase.chatId ?? currentCase.id,
        },
        replace: true,
      })
      return
    }
    if (
      routeCaseId &&
      routeChatId &&
      currentCase &&
      routeChatId !== (currentCase.chatId ?? currentCase.id)
    ) {
      navigate({ to: '/cases', replace: true })
    }
  }, [
    currentCase,
    currentChat,
    isCasesLoading,
    navigate,
    routeCaseId,
    routeChatId,
    selectChat,
  ])

  function handleCreateChat() {
    const chat = createChat()
    navigate({
      to: '/chat/$chatId',
      params: { chatId: chat.id },
    })
  }

  function handleSelectChat(chatId) {
    selectChat(chatId)
    navigate({
      to: '/chat/$chatId',
      params: { chatId },
    })
  }

  async function addChatFiles(fileList, source = 'upload') {
    const rejectedFiles = []
    const validFiles = []

    for (const file of Array.from(fileList)) {
      if (file.size > 25 * 1024 * 1024) {
        rejectedFiles.push(`${file.name} exceeds the 25 MB limit`)
      } else {
        validFiles.push(file)
      }
    }

    if (rejectedFiles.length > 0) setNotice(rejectedFiles.join('. '))
    if (validFiles.length > 0) {
      try {
        if (isCaseChat) {
          const caseDocs = await addCaseFiles(caseId, validFiles, source)
          if (Array.isArray(caseDocs) && caseDocs.length > 0) {
            setStagedFiles((prev) => [...prev, ...caseDocs])
          }
        } else {
          const results = await Promise.allSettled(
            validFiles.map((file) => uploadChatAttachment(file, source, effectiveChatId)),
          )
          const newAttachments = results
            .filter((r) => r.status === 'fulfilled')
            .map((r) => r.value)
          const uploadErrors = results
            .filter((r) => r.status === 'rejected')
            .map((r) => r.reason.message)

          if (newAttachments.length > 0) {
            setGeneralChatFiles((prev) => [...newAttachments, ...prev])
            setStagedFiles((prev) => [...prev, ...newAttachments])
          }
          if (uploadErrors.length > 0) {
            setNotice(uploadErrors.join('. '))
          }
        }
      } catch (error) {
        setNotice(error.message)
      }
    }
  }

  async function removeChatFile(fileId) {
    try {
      if (isCaseChat) {
        await removeCaseFile(caseId, fileId)
      } else {
        await deleteChatAttachment(fileId, effectiveChatId)
        setGeneralChatFiles((prev) => prev.filter((f) => f.id !== fileId))
      }
    } catch (error) {
      setNotice(error.message)
    }
  }

  async function removeStagedFile(fileId) {
    setStagedFiles((prev) => prev.filter((f) => f.id !== fileId))
    await removeChatFile(fileId)
  }

  async function sendMessage(text, attachedFiles = []) {
    if (isTyping) return
    const isCaseChat = Boolean(routeCaseId)
    const responseConversationId = conversationId
    const responseCaseId = caseId
    const responseChatId = isCaseChat ? caseChatId : (currentChat?.id ?? conversationId)
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      attachments: attachedFiles,
    }

    if (routeCaseId) {
      addCaseMessages(caseId, [userMessage])
    } else {
      addChatMessages(responseChatId, [userMessage])
      if (!routeChatId) {
        navigate({
          to: '/chat/$chatId',
          params: { chatId: responseChatId },
        })
      }
    }
    setStagedFiles([])
    setTypingConversationIds((currentIds) =>
      currentIds.includes(responseConversationId)
        ? currentIds
        : [...currentIds, responseConversationId],
    )

    const assistantMsgId = crypto.randomUUID()

    try {
      const history = baseMessages
        .filter((message) =>
          ['user', 'assistant'].includes(message.role) &&
          typeof message.content === 'string' &&
          message.content.trim(),
        )
        .map(({ role, content }) => ({ role, content }))

      let currentSources = []
      const res = await requestChatReply(
        [...history, { role: 'user', content: text, attachments: attachedFiles }],
        {
          chatId: responseConversationId,
          attachment_ids: attachedFiles.map((f) => f.id),
          ...(isCaseChat ? { caseId: responseCaseId } : {}),
          onDelta: (partialReply) => {
            setStreamingState({
              conversationId: responseConversationId,
              message: {
                id: assistantMsgId,
                role: 'assistant',
                content: partialReply,
                sources: currentSources,
              },
            })
          },
          onSources: (incomingSources) => {
            currentSources = Array.isArray(incomingSources) ? incomingSources : []
            setStreamingState((prev) => {
              if (prev && prev.conversationId === responseConversationId) {
                return {
                  ...prev,
                  message: {
                    ...prev.message,
                    sources: currentSources,
                  },
                }
              }
              return prev
            })
          },
        },
      )
      const finalReply = typeof res === 'string' ? res : (res?.reply ?? '')
      const finalSources = (res && typeof res === 'object' && Array.isArray(res.sources))
        ? res.sources
        : currentSources

      const assistantMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: finalReply,
        sources: finalSources,
      }

      if (isCaseChat) {
        addCaseMessages(responseCaseId, [assistantMessage])
      } else {
        addChatMessages(responseChatId, [assistantMessage])
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The chat request failed. Please try again.')
    } finally {
      setStreamingState(null)
      setTypingConversationIds((currentIds) =>
        currentIds.filter((id) => id !== responseConversationId),
      )
    }
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          height: '100vh',
          minHeight: '100svh',
          bgcolor: 'background.default',
          '@media (max-width:600px)': { height: 'auto' },
        }}
      >
        <ChatSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <ChatHistoryPanel
          chats={visibleChats}
          activeChatId={isCaseChat ? caseChatId : conversationId}
          onCreateChat={isCaseChat ? undefined : handleCreateChat}
          onSelectChat={isCaseChat ? () => {} : handleSelectChat}
          onTogglePinned={isCaseChat ? () => {} : toggleChatPinned}
          onRenameChat={!isCaseChat ? renameChat : undefined}
          onDeleteChat={isCaseChat ? () => {} : deleteChat}
          chatListTitle={isCaseChat ? 'CASE CHAT' : 'ALL CHATS'}
          emptyMessage={isCaseChat ? 'Your case chat will appear here.' : 'Start a chat to see it here.'}
          showChatActions={!isCaseChat}
          isCollapsed={isHistoryCollapsed}
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
        <Box
          component="main"
          sx={{
            display: 'flex',
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            px: { xs: 2, sm: 3, lg: 6 },
            '@media (max-width:600px)': { height: 'auto', minHeight: '100svh' },
          }}
        >
          <ChatHeader
            isCaseChat={isCaseChat}
            onMenuClick={() => setIsSidebarOpen(true)}
            onHistoryClick={() => setIsHistoryOpen(true)}
            onCreateChat={!isCaseChat ? handleCreateChat : undefined}
            onToggleHistoryPanel={() => setIsHistoryCollapsed((collapsed) => !collapsed)}
            isHistoryCollapsed={isHistoryCollapsed}
            attachmentCount={chatFiles.length}
            onViewFiles={() => setIsFilesOpen(true)}
            onRenameChat={!isCaseChat ? (newTitle) => renameChat(effectiveChatId, newTitle) : undefined}
            caseTitle={isCaseChat ? currentCase?.title : currentChat?.title}
            matterType={currentCase?.isDefault ? undefined : currentCase?.matterType}
            caseAccessMembers={
              routeCaseId && currentCase && !currentCase.isDefault
                ? teamMembers.filter((member) => member.caseAccess.includes(caseId))
                : []
            }
          />
          {messages.length === 0 ? (
            <ChatEmptyState currentCase={currentCase} isDark={isDark} />
          ) : (
            <ChatMessages
              messages={messages}
              caseId={routeCaseId}
              chatId={conversationId}
              isAssistantTyping={isAssistantTyping}
              onBranch={
                routeCaseId
                  ? undefined
                  : (messageIndex) => {
                      const chatIdToBranch = currentChat?.id ?? conversationId
                      const chat = chatIdToBranch ? branchChat(chatIdToBranch, messageIndex) : null
                      if (chat) {
                        navigate({
                          to: '/chat/$chatId',
                          params: { chatId: chat.id },
                        })
                      }
                    }
              }
            />
          )}
          <ChatComposer
            key={effectiveChatId}
            onSend={sendMessage}
            onFilesAdded={(files) => addChatFiles(files)}
            onOpenCamera={() => setIsCameraOpen(true)}
            onAudioError={setNotice}
            attachmentCount={chatFiles.length}
            disabled={isAssistantTyping}
            stagedFiles={stagedFiles}
            onRemoveStagedFile={removeStagedFile}
            onViewFiles={() => setIsFilesOpen(true)}
          />
        </Box>
      </Box>
      <ChatFilesDialog
        open={isFilesOpen}
        onClose={() => setIsFilesOpen(false)}
        files={chatFiles}
        chatId={conversationId}
        onRemove={removeChatFile}
        onAddFiles={() => {
          setIsFilesOpen(false)
          document.getElementById('chat-document-input')?.click()
        }}
      />
      <ChatCameraDialog
        open={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={(file) => addChatFiles([file], 'camera')}
      />
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={7000}
        onClose={() => setNotice('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setNotice('')} severity="warning" variant="filled" sx={{ fontSize: 'body2.fontSize' }}>
          {notice}
        </Alert>
      </Snackbar>
    </>
  )
}

export default ChatLayout
