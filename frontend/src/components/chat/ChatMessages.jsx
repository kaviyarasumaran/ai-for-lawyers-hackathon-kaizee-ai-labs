import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import CheckOutlinedIcon from "@mui/icons-material/CheckOutlined";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import KeyboardArrowUpOutlinedIcon from "@mui/icons-material/KeyboardArrowUpOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import MarkdownView from "./MarkdownView";

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMediaType(item) {
  const type = (item?.type || "").toLowerCase();
  const name = (item?.name || "").toLowerCase();
  const ext = name.split(".").pop() || "";
  if (
    type.startsWith("image/") ||
    [
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "bmp",
      "svg",
      "heic",
      "tiff",
      "tif",
    ].includes(ext)
  ) {
    return "image";
  }
  // Audio check: prioritize audio types and filenames (voice recordings, audio notes)
  const isAudio =
    type.startsWith("audio/") ||
    ["mp3", "wav", "m4a", "ogg", "aac", "flac", "wma", "weba"].includes(ext) ||
    (ext === "webm" &&
      (type.includes("audio") ||
        name.includes("voice") ||
        name.includes("audio") ||
        !name.includes("video")));
  if (isAudio) {
    return "audio";
  }
  if (
    type.startsWith("video/") ||
    ["mp4", "mov", "avi", "mkv", "flv", "m4v", "webm"].includes(ext)
  ) {
    return "video";
  }
  return "document";
}

function MessageAttachmentCard({ attachment, isDark, chatId }) {
  const mediaType = getMediaType(attachment);
  const query = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : "";
  const fileUrl =
    attachment?.url ||
    (attachment?.id
      ? `/api/chat/attachments/${encodeURIComponent(attachment.id)}/file${query}`
      : "#");

  if (mediaType === "image") {
    return (
      <Box
        component="a"
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        sx={{
          display: "block",
          textDecoration: "none",
          color: "inherit",
          borderRadius: 2,
          overflow: "hidden",
          border: "1px solid",
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
          bgcolor: isDark ? "#1a271e" : "#fff",
          maxWidth: 340,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          transition: "transform 140ms ease, box-shadow 140ms ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
          },
        }}
      >
        <Box
          component="img"
          src={fileUrl}
          alt={attachment.name || "Attached image"}
          onError={(e) => {
            if (attachment.id && !e.target.dataset.fallback) {
              e.target.dataset.fallback = "true";
              e.target.src = `/api/chat/attachments/${encodeURIComponent(attachment.id)}/file`;
            }
          }}
          sx={{
            display: "block",
            width: "100%",
            maxHeight: 220,
            objectFit: "cover",
            bgcolor: isDark ? "#111813" : "#f0f0f0",
          }}
        />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 1,
          }}
        >
          <Typography
            noWrap
            sx={{ fontSize: "caption.fontSize", fontWeight: 600 }}
          >
            {attachment.name}
          </Typography>
          <OpenInNewRoundedIcon sx={{ fontSize: 15, opacity: 0.7, ml: 1 }} />
        </Box>
      </Box>
    );
  }

  if (mediaType === "audio") {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: 1.25,
          borderRadius: 2,
          bgcolor: isDark ? "#1e2b21" : "#fff",
          borderColor: isDark ? "#3a5441" : "#d2e3d3",
          display: "flex",
          flexDirection: "column",
          gap: 0.75,
          minWidth: 260,
          maxWidth: 360,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <GraphicEqRoundedIcon sx={{ fontSize: 18, color: "primary.main" }} />
          <Typography
            noWrap
            sx={{ fontSize: "caption.fontSize", fontWeight: 600, flex: 1 }}
          >
            {attachment.name}
          </Typography>
          {attachment.size ? (
            <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
              {formatBytes(attachment.size)}
            </Typography>
          ) : null}
        </Box>
        <Box
          component="audio"
          controls
          src={fileUrl}
          onError={(e) => {
            if (attachment.id && !e.target.dataset.fallback) {
              e.target.dataset.fallback = "true";
              e.target.src = `/api/chat/attachments/${encodeURIComponent(attachment.id)}/file`;
            }
          }}
          sx={{ width: "100%", height: 36 }}
        />
      </Paper>
    );
  }

  if (mediaType === "video") {
    return (
      <Paper
        variant="outlined"
        sx={{
          overflow: "hidden",
          borderRadius: 2,
          bgcolor: isDark ? "#1e2b21" : "#fff",
          borderColor: isDark ? "#3a5441" : "#d2e3d3",
          maxWidth: 360,
        }}
      >
        <Box
          component="video"
          controls
          src={fileUrl}
          onError={(e) => {
            if (attachment.id && !e.target.dataset.fallback) {
              e.target.dataset.fallback = "true";
              e.target.src = `/api/chat/attachments/${encodeURIComponent(attachment.id)}/file`;
            }
          }}
          sx={{
            width: "100%",
            maxHeight: 220,
            display: "block",
            bgcolor: "#000",
          }}
        />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 1,
          }}
        >
          <Typography
            noWrap
            sx={{ fontSize: "caption.fontSize", fontWeight: 600, flex: 1 }}
          >
            {attachment.name}
          </Typography>
          {attachment.size ? (
            <Typography
              sx={{ fontSize: "0.72rem", color: "text.secondary", ml: 1 }}
            >
              {formatBytes(attachment.size)}
            </Typography>
          ) : null}
        </Box>
      </Paper>
    );
  }

  const isPdf = attachment.name?.toLowerCase().endsWith(".pdf");
  return (
    <Paper
      component="a"
      href={fileUrl}
      target="_blank"
      rel="noreferrer"
      variant="outlined"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        p: "8px 12px",
        borderRadius: 2,
        textDecoration: "none",
        color: "inherit",
        bgcolor: isDark ? "#1e2b21" : "#fff",
        borderColor: isDark ? "#3a5441" : "#d2e3d3",
        minWidth: 220,
        maxWidth: 360,
        transition: "background-color 140ms ease, border-color 140ms ease",
        "&:hover": {
          bgcolor: isDark ? "#26372a" : "#f4f8f4",
          borderColor: "primary.main",
        },
      }}
    >
      <Box
        sx={{
          display: "grid",
          width: 34,
          height: 34,
          flex: "none",
          placeItems: "center",
          borderRadius: 1.5,
          bgcolor: isDark ? "#283b2e" : "#eef4ee",
          color: isPdf ? "#b5685d" : "primary.main",
        }}
      >
        {isPdf ? (
          <PictureAsPdfOutlinedIcon sx={{ fontSize: 20 }} />
        ) : (
          <InsertDriveFileOutlinedIcon sx={{ fontSize: 20 }} />
        )}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          noWrap
          sx={{
            fontSize: "caption.fontSize",
            fontWeight: 600,
            color: "text.primary",
          }}
        >
          {attachment.name}
        </Typography>
        <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
          {attachment.size ? formatBytes(attachment.size) : "Document"} · Click
          to view
        </Typography>
      </Box>
      <OpenInNewRoundedIcon
        sx={{ fontSize: 16, color: "text.secondary", flex: "none" }}
      />
    </Paper>
  );
}

const INITIAL_PAGE_SIZE = 25;
const BATCH_SIZE = 20;

function resolveSourceFileUrl(source, caseId, chatId) {
  if (
    source?.url &&
    (source.url.startsWith("http") || source.url.startsWith("/"))
  ) {
    return source.url;
  }
  const docId = source?.document_id || source?.id;
  if (!docId) return null;

  if (source?.sourceType === "global_legal_authority") {
    return `/api/knowledge-base/documents/${encodeURIComponent(docId)}/file`;
  }
  if (source?.sourceType === "case_document" && caseId) {
    return `/api/cases/${encodeURIComponent(caseId)}/documents/${encodeURIComponent(docId)}/file`;
  }
  const query = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : "";
  return `/api/chat/attachments/${encodeURIComponent(docId)}/file${query}`;
}

function SourceTriggerButton({ count, onClick, isDark }) {
  return (
    <Button
      size="small"
      variant="outlined"
      onClick={onClick}
      startIcon={<MenuBookOutlinedIcon sx={{ fontSize: 15 }} />}
      endIcon={<ChevronRightRoundedIcon sx={{ fontSize: 18 }} />}
      sx={{
        borderRadius: 999,
        textTransform: "none",
        fontSize: "0.78rem",
        fontWeight: 600,
        px: 1.5,
        py: 0.35,
        mt: 1.25,
        bgcolor: isDark ? "rgba(76,175,80,0.08)" : "rgba(46,125,50,0.05)",
        borderColor: isDark ? "rgba(76,175,80,0.3)" : "rgba(46,125,50,0.25)",
        color: isDark ? "#81c784" : "#2e7d32",
        transition: "all 140ms ease",
        "&:hover": {
          bgcolor: isDark ? "rgba(76,175,80,0.18)" : "rgba(46,125,50,0.12)",
          borderColor: "primary.main",
          transform: "translateX(2px)",
        },
      }}
    >
      Sources ({count})
    </Button>
  );
}

function SourceDrawerCard({ index, source, caseId, chatId, isDark }) {
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedCitation, setCopiedCitation] = useState(false);

  const fileUrl = resolveSourceFileUrl(source, caseId, chatId);
  const isGlobalKb =
    source.sourceType === "global_legal_authority" || Boolean(source.section);
  const typeLabel = isGlobalKb
    ? "Indian Law Knowledge Base"
    : source.sourceType === "case_document"
      ? "Case Document"
      : "Uploaded Media";

  const snippetText = (source.snippet || source.content || "").trim();

  async function handleCopySnippet() {
    if (!snippetText) return;
    try {
      await navigator.clipboard.writeText(snippetText);
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      // ignore
    }
  }

  async function handleCopyCitation() {
    const citation = `${source.name}${source.section ? ` (${source.section})` : ""}, Page ${source.pageStart || 1}`;
    try {
      await navigator.clipboard.writeText(citation);
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2.5,
        bgcolor: isDark ? "#1f2c22" : "#ffffff",
        borderColor: isDark ? "#3a5441" : "#d8e4d8",
        boxShadow: isDark
          ? "0 2px 8px rgba(0,0,0,0.2)"
          : "0 2px 8px rgba(0,0,0,0.03)",
        display: "flex",
        flexDirection: "column",
        gap: 1.25,
      }}
    >
      {/* Top Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            minWidth: 0,
            flex: 1,
          }}
        >
          <Box
            sx={{
              display: "grid",
              placeItems: "center",
              width: 24,
              height: 24,
              borderRadius: 1,
              bgcolor: isDark ? "#2a3d2e" : "#eaf2ea",
              color: "primary.main",
              fontSize: "0.75rem",
              fontWeight: 700,
              flex: "none",
            }}
          >
            {index}
          </Box>
          <Typography
            sx={{
              fontSize: "0.88rem",
              fontWeight: 700,
              color: "text.primary",
              lineHeight: 1.3,
            }}
          >
            {source.name}
          </Typography>
        </Box>

        <Chip
          size="small"
          label={typeLabel}
          sx={{
            height: 20,
            fontSize: "0.7rem",
            fontWeight: 600,
            bgcolor: isDark ? "rgba(76,175,80,0.18)" : "rgba(46,125,50,0.08)",
            color: isDark ? "#81c784" : "#1b5e20",
            border: "1px solid",
            borderColor: isDark ? "rgba(76,175,80,0.3)" : "rgba(46,125,50,0.2)",
            flex: "none",
          }}
        />
      </Box>

      {/* Section & Page row */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0.75,
          alignItems: "center",
        }}
      >
        {source.section && (
          <Chip
            size="small"
            label={source.section}
            sx={{
              fontSize: "0.75rem",
              fontWeight: 700,
              bgcolor: isDark
                ? "rgba(33,150,243,0.18)"
                : "rgba(25,118,210,0.08)",
              color: isDark ? "#90caf9" : "#0d47a1",
              border: "1px solid",
              borderColor: isDark
                ? "rgba(33,150,243,0.3)"
                : "rgba(25,118,210,0.2)",
            }}
          />
        )}
        {source.pageStart ? (
          <Typography
            sx={{
              fontSize: "0.75rem",
              color: "text.secondary",
              fontWeight: 500,
            }}
          >
            Page {source.pageStart}
            {source.pageEnd && source.pageEnd !== source.pageStart
              ? ` - ${source.pageEnd}`
              : ""}
          </Typography>
        ) : null}
      </Box>

      {/* Snippet / Provision excerpt */}
      {snippetText && (
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: isDark ? "#141e17" : "#f8faf8",
            border: "1px solid",
            borderColor: isDark ? "#2e4434" : "#e2ece2",
            borderLeft: "3px solid",
            borderLeftColor: "primary.main",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.8rem",
              lineHeight: 1.65,
              color: "text.primary",
              whiteSpace: "pre-wrap",
              maxHeight: 180,
              overflowY: "auto",
            }}
          >
            {snippetText}
          </Typography>
        </Box>
      )}

      {/* Action buttons */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          pt: 0.5,
        }}
      >
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {snippetText && (
            <Button
              size="small"
              variant="text"
              startIcon={
                copiedSnippet ? (
                  <CheckOutlinedIcon sx={{ fontSize: 14 }} />
                ) : (
                  <ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />
                )
              }
              onClick={handleCopySnippet}
              sx={{
                textTransform: "none",
                fontSize: "0.72rem",
                py: 0.25,
                px: 1,
                color: copiedSnippet ? "primary.main" : "text.secondary",
              }}
            >
              {copiedSnippet ? "Copied" : "Copy Text"}
            </Button>
          )}

          <Button
            size="small"
            variant="text"
            startIcon={
              copiedCitation ? (
                <CheckOutlinedIcon sx={{ fontSize: 14 }} />
              ) : (
                <ContentCopyOutlinedIcon sx={{ fontSize: 14 }} />
              )
            }
            onClick={handleCopyCitation}
            sx={{
              textTransform: "none",
              fontSize: "0.72rem",
              py: 0.25,
              px: 1,
              color: copiedCitation ? "primary.main" : "text.secondary",
            }}
          >
            {copiedCitation ? "Cited" : "Cite"}
          </Button>
        </Box>

        {fileUrl && (
          <Button
            size="small"
            variant="outlined"
            component="a"
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 13 }} />}
            sx={{
              textTransform: "none",
              fontSize: "0.75rem",
              fontWeight: 600,
              py: 0.25,
              px: 1.25,
              borderRadius: 1.5,
              borderColor: isDark
                ? "rgba(255,255,255,0.18)"
                : "rgba(0,0,0,0.15)",
              color: "text.primary",
              "&:hover": {
                borderColor: "primary.main",
                bgcolor: isDark
                  ? "rgba(76,175,80,0.08)"
                  : "rgba(46,125,50,0.05)",
              },
            }}
          >
            Open File
          </Button>
        )}
      </Box>
    </Paper>
  );
}

function SourcesDrawer({ open, sources, caseId, chatId, onClose, isDark }) {
  if (!Array.isArray(sources) || sources.length === 0) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            display: "flex",
            width: { xs: "100vw", sm: 480, md: 540 },
            minWidth: 0,
            maxWidth: "100vw",
            flexDirection: "column",
            bgcolor: isDark ? "#1a241c" : "#fbfbf9",
            borderLeft: "1px solid",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "divider",
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          minHeight: 68,
          alignItems: "center",
          gap: 1.5,
          px: 2.5,
          py: 1.5,
        }}
      >
        <Box
          sx={{
            display: "grid",
            width: 38,
            height: 38,
            placeItems: "center",
            borderRadius: 2,
            color: "primary.main",
            bgcolor: isDark ? "rgba(54,117,77,0.2)" : "#e9f1e9",
          }}
        >
          <MenuBookOutlinedIcon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography
              sx={{ fontSize: 16, fontWeight: 700, color: "text.primary" }}
            >
              Sources & Knowledge Base
            </Typography>
            <Chip
              label={sources.length}
              size="small"
              sx={{
                height: 20,
                fontSize: "caption.fontSize",
                fontWeight: 700,
                bgcolor: isDark ? "rgba(255,255,255,0.08)" : "#eef3ee",
                color: "primary.main",
              }}
            />
          </Box>
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
            Authorities, statutes, and evidence cited in this response
          </Typography>
        </Box>
        <IconButton
          aria-label="Close sources drawer"
          onClick={onClose}
          size="small"
          sx={{
            color: "text.secondary",
            "&:hover": {
              color: "text.primary",
              bgcolor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
            },
          }}
        >
          <CloseRoundedIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </Box>

      <Divider />

      {/* Body: list of source cards */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 2.5,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {sources.map((source, index) => (
          <SourceDrawerCard
            key={source.id || index}
            index={index + 1}
            source={source}
            caseId={caseId}
            chatId={chatId}
            isDark={isDark}
          />
        ))}
      </Box>

      <Divider />

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          px: 2.5,
          display: "flex",
          justifyContent: "flex-end",
          bgcolor: isDark ? "#141d16" : "#f5f7f5",
        }}
      >
        <Button
          variant="contained"
          size="small"
          onClick={onClose}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.8rem",
            borderRadius: 1.5,
            px: 2.5,
          }}
        >
          Done
        </Button>
      </Box>
    </Drawer>
  );
}

function ChatMessages({
  messages,
  caseId,
  chatId,
  isAssistantTyping = false,
  onBranch,
}) {
  const isDark = useTheme().palette.mode === "dark";
  const containerRef = useRef(null);
  const endOfMessagesRef = useRef(null);
  const [copiedId, setCopiedId] = useState(null);
  const [drawerSources, setDrawerSources] = useState(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const isPrependingRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const prevMessagesLengthRef = useRef(messages.length);
  const isInitialRenderRef = useRef(true);

  const firstMessageId = messages[0]?.id;
  const prevFirstMessageIdRef = useRef(firstMessageId);

  // Reset pagination if user switches to a different chat
  useEffect(() => {
    if (firstMessageId !== prevFirstMessageIdRef.current) {
      prevFirstMessageIdRef.current = firstMessageId;
      setVisibleCount(INITIAL_PAGE_SIZE);
      isInitialRenderRef.current = true;
    }
  }, [firstMessageId]);

  // Automatically expand visible count when new messages are added so the latest message is always rendered
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current) {
      const addedCount = messages.length - prevMessagesLengthRef.current;
      setVisibleCount((prev) => prev + addedCount);
    }
  }, [messages.length]);

  // Maintain scroll position when earlier messages are loaded, or scroll to bottom on new message
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (isPrependingRef.current) {
      const scrollDiff = el.scrollHeight - prevScrollHeightRef.current;
      el.scrollTop += scrollDiff;
      isPrependingRef.current = false;
    } else if (isInitialRenderRef.current) {
      el.scrollTop = el.scrollHeight;
      isInitialRenderRef.current = false;
    } else if (
      messages.length > prevMessagesLengthRef.current ||
      isAssistantTyping
    ) {
      endOfMessagesRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, visibleCount, isAssistantTyping]);

  function handleLoadEarlier() {
    if (visibleCount >= messages.length) return;
    isPrependingRef.current = true;
    if (containerRef.current) {
      prevScrollHeightRef.current = containerRef.current.scrollHeight;
    }
    setVisibleCount((prev) => Math.min(messages.length, prev + BATCH_SIZE));
  }

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    if (
      el.scrollTop < 40 &&
      visibleCount < messages.length &&
      !isPrependingRef.current
    ) {
      handleLoadEarlier();
    }
  }

  async function handleCopy(messageId, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard write failures
    }
  }

  const startIndex = Math.max(0, messages.length - visibleCount);
  const visibleMessages = messages.slice(startIndex);
  const hasEarlier = startIndex > 0;

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      component="section"
      aria-label="Conversation"
      sx={{
        display: "flex",
        width: "min(100%, 900px)",
        flex: 1,
        flexDirection: "column",
        gap: 3,
        overflowY: "auto",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "&::-webkit-scrollbar": {
          display: "none",
          width: 0,
          height: 0,
        },
        py: { xs: 3, md: 4.5 },
      }}
    >
      {hasEarlier && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            my: 1,
            flex: "none",
          }}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={handleLoadEarlier}
            startIcon={<KeyboardArrowUpOutlinedIcon sx={{ fontSize: 18 }} />}
            sx={{
              borderRadius: 999,
              textTransform: "none",
              fontSize: "0.8rem",
              fontWeight: 500,
              px: 2,
              py: 0.5,
              borderColor: isDark
                ? "rgba(255,255,255,0.18)"
                : "rgba(0,0,0,0.14)",
              color: "text.secondary",
              bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
              backdropFilter: "blur(8px)",
              "&:hover": {
                borderColor: "primary.main",
                color: "text.primary",
                bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
              },
            }}
          >
            Load earlier messages ({startIndex} remaining)
          </Button>
        </Box>
      )}

      {visibleMessages.map((message, index) => {
        const isAssistant = message.role === "assistant";
        const isCopied = copiedId === message.id;
        const originalIndex = startIndex + index;

        return (
          <Box
            component="article"
            key={message.id}
            sx={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: isAssistant ? "flex-start" : "flex-end",
              gap: 1.5,
              width: "100%",
            }}
          >
            {isAssistant && (
              <Box
                aria-hidden="true"
                sx={{
                  display: "grid",
                  width: 32,
                  height: 32,
                  flex: "none",
                  placeItems: "center",
                  borderRadius: 2,
                  color: "primary.main",
                  bgcolor: isDark ? "#29372f" : "#e9f1e9",
                  mt: 0.25,
                }}
              >
                <GavelOutlinedIcon sx={{ fontSize: 19 }} />
              </Box>
            )}

            <Box
              sx={{
                maxWidth: isAssistant ? "min(92%, 820px)" : "min(85%, 680px)",
                width: isAssistant ? "100%" : "auto",
              }}
            >
              <Typography
                sx={{
                  mb: 0.75,
                  color: "text.secondary",
                  textAlign: isAssistant ? "left" : "right",
                  fontSize: "caption.fontSize",
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                }}
              >
                {isAssistant ? "Counsel assistant" : "You"}
              </Typography>

              {isAssistant ? (
                // Assistant response rendered as open Markdown view (box removed)
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    width: "100%",
                  }}
                >
                  <MarkdownView content={message.content} />

                  {message.sources && message.sources.length > 0 && (
                    <SourceTriggerButton
                      count={message.sources.length}
                      onClick={() => setDrawerSources(message.sources)}
                      isDark={isDark}
                    />
                  )}

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.5,
                      mt: 1,
                    }}
                  >
                    <Tooltip
                      title={isCopied ? "Copied to clipboard" : "Copy response"}
                    >
                      <IconButton
                        aria-label="Copy assistant response"
                        onClick={() => handleCopy(message.id, message.content)}
                        size="small"
                        sx={{
                          color: isCopied ? "primary.main" : "text.secondary",
                          p: 0.6,
                          "&:hover": { color: "text.primary" },
                        }}
                      >
                        {isCopied ? (
                          <CheckOutlinedIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </Tooltip>

                    {onBranch && (
                      <Tooltip title="Branch chat from this message">
                        <IconButton
                          aria-label={`Branch chat from message ${originalIndex + 1}`}
                          onClick={() => onBranch(originalIndex)}
                          size="small"
                          sx={{
                            color: "text.secondary",
                            p: 0.6,
                            "&:hover": { color: "text.primary" },
                          }}
                        >
                          <CallSplitOutlinedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              ) : (
                // User message in conversation bubble
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    maxWidth: "100%",
                  }}
                >
                  <Box
                    sx={{
                      p: "12px 16px",
                      border: "1px solid",
                      borderColor: isDark ? "#3a5441" : "#e3ede3",
                      borderRadius: "14px 3px 14px 14px",
                      color: isDark ? "#d1e5d4" : "#355342",
                      bgcolor: isDark ? "#24372a" : "#edf4ed",
                      maxWidth: "100%",
                    }}
                  >
                    {message.attachments && message.attachments.length > 0 && (
                      <Box
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 1,
                          mb: message.content ? 1.25 : 0,
                        }}
                      >
                        {message.attachments.map((att, attIdx) => (
                          <MessageAttachmentCard
                            key={att.id || attIdx}
                            attachment={att}
                            isDark={isDark}
                            chatId={chatId}
                          />
                        ))}
                      </Box>
                    )}
                    {message.content && (
                      <Typography
                        sx={{
                          fontSize: "body2.fontSize",
                          lineHeight: 1.7,
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {message.content}
                      </Typography>
                    )}
                  </Box>

                  {onBranch && (
                    <Tooltip title="Branch chat from this message">
                      <IconButton
                        aria-label={`Branch chat from message ${originalIndex + 1}`}
                        onClick={() => onBranch(originalIndex)}
                        size="small"
                        sx={{ mt: 0.25, color: "text.secondary" }}
                      >
                        <CallSplitOutlinedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        );
      })}

      {isAssistantTyping && (
        <Box
          component="article"
          aria-label="Assistant is preparing a response"
          aria-live="polite"
          sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}
        >
          <Box
            aria-hidden="true"
            sx={{
              display: "grid",
              width: 32,
              height: 32,
              flex: "none",
              placeItems: "center",
              borderRadius: 2,
              color: "primary.main",
              bgcolor: isDark ? "#29372f" : "#e9f1e9",
              mt: 0.25,
            }}
          >
            <GavelOutlinedIcon sx={{ fontSize: 19 }} />
          </Box>
          <Box>
            <Typography
              sx={{
                mb: 0.75,
                color: "text.secondary",
                fontSize: "caption.fontSize",
                fontWeight: 600,
              }}
            >
              Counsel assistant
            </Typography>
            <Box
              role="status"
              sx={{
                display: "flex",
                minHeight: 38,
                alignItems: "center",
                gap: 0.65,
                px: 1.5,
                py: 0.5,
              }}
            >
              {[0, 1, 2].map((dot) => (
                <Box
                  key={dot}
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                    opacity: 0.45,
                    animation: "assistantTyping 1.1s ease-in-out infinite",
                    animationDelay: `${dot * 160}ms`,
                    "@keyframes assistantTyping": {
                      "0%, 60%, 100%": {
                        transform: "translateY(0)",
                        opacity: 0.4,
                      },
                      "30%": { transform: "translateY(-4px)", opacity: 1 },
                    },
                  }}
                />
              ))}
              <Typography
                sx={{
                  ml: 0.75,
                  color: "text.secondary",
                  fontSize: "caption.fontSize",
                }}
              >
                Analyzing documents and preparing response...
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
      <Box ref={endOfMessagesRef} aria-hidden="true" sx={{ flex: "none" }} />

      <SourcesDrawer
        open={Boolean(drawerSources && drawerSources.length > 0)}
        sources={drawerSources || []}
        caseId={caseId}
        chatId={chatId}
        onClose={() => setDrawerSources(null)}
        isDark={isDark}
      />
    </Box>
  );
}

export default ChatMessages;
