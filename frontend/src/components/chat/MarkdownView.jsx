import { useMemo } from 'react'
import { Box, useTheme } from '@mui/material'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

// Configure marked with sensible defaults for legal and technical markdown
marked.setOptions({
  gfm: true,
  breaks: true,
})

function MarkdownView({ content = '', sx = {} }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const html = useMemo(() => {
    if (!content || typeof content !== 'string') return ''
    try {
      const rawHtml = marked.parse(content)
      return DOMPurify.sanitize(rawHtml, {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target', 'rel'],
      })
    } catch {
      return DOMPurify.sanitize(content)
    }
  }, [content])

  return (
    <Box
      className="markdown-content"
      dangerouslySetInnerHTML={{ __html: html }}
      sx={{
        width: '100%',
        color: 'text.primary',
        fontSize: '0.9375rem',
        lineHeight: 1.7,
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',

        // Headings
        '& h1': {
          fontSize: '1.35rem',
          fontWeight: 700,
          mt: 2,
          mb: 1,
          lineHeight: 1.35,
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
          pb: 0.5,
          '&:first-child': { mt: 0 },
        },
        '& h2': {
          fontSize: '1.18rem',
          fontWeight: 650,
          mt: 1.75,
          mb: 0.75,
          lineHeight: 1.35,
          color: 'text.primary',
          '&:first-child': { mt: 0 },
        },
        '& h3': {
          fontSize: '1.05rem',
          fontWeight: 600,
          mt: 1.5,
          mb: 0.5,
          lineHeight: 1.4,
          color: 'text.primary',
          '&:first-child': { mt: 0 },
        },
        '& h4, & h5, & h6': {
          fontSize: '0.95rem',
          fontWeight: 600,
          mt: 1.25,
          mb: 0.4,
          lineHeight: 1.4,
          color: 'text.primary',
          '&:first-child': { mt: 0 },
        },

        // Paragraphs
        '& p': {
          my: 0.75,
          '&:first-child': { mt: 0 },
          '&:last-child': { mb: 0 },
        },

        // Strong & Emphasis
        '& strong, & b': {
          fontWeight: 650,
          color: isDark ? '#f1f5f9' : '#0f172a',
        },
        '& em, & i': {
          fontStyle: 'italic',
        },

        // Lists
        '& ul, & ol': {
          my: 0.75,
          pl: 2.75,
          '&:first-child': { mt: 0 },
          '&:last-child': { mb: 0 },
        },
        '& li': {
          my: 0.35,
          lineHeight: 1.65,
          '& > p': {
            my: 0.2,
          },
        },
        '& ul > li': {
          listStyleType: 'disc',
        },
        '& ol > li': {
          listStyleType: 'decimal',
        },

        // Blockquotes (Callouts, Legal Notes)
        '& blockquote': {
          my: 1.25,
          py: 0.6,
          px: 1.5,
          borderLeft: '3.5px solid',
          borderColor: 'primary.main',
          bgcolor: isDark ? 'rgba(74, 222, 128, 0.06)' : 'rgba(46, 125, 50, 0.05)',
          borderRadius: '0 8px 8px 0',
          color: 'text.secondary',
          '& p': {
            my: 0.25,
          },
          '&:first-child': { mt: 0 },
          '&:last-child': { mb: 0 },
        },

        // Code
        '& code': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.86em',
          px: '5px',
          py: '2px',
          borderRadius: '4px',
          bgcolor: isDark ? '#26372d' : '#edf4ed',
          border: '1px solid',
          borderColor: isDark ? '#364d3f' : '#d7e6d7',
          color: isDark ? '#86efac' : '#1b5e20',
        },
        '& pre': {
          my: 1.25,
          p: 1.5,
          borderRadius: '8px',
          bgcolor: isDark ? '#1a241e' : '#f5f8f5',
          border: '1px solid',
          borderColor: 'divider',
          overflowX: 'auto',
          '& code': {
            p: 0,
            bgcolor: 'transparent',
            border: 'none',
            color: 'inherit',
            fontSize: '0.86rem',
            lineHeight: 1.55,
          },
        },

        // Tables
        '& table': {
          width: '100%',
          my: 1.25,
          borderCollapse: 'collapse',
          overflowX: 'auto',
          display: 'block',
          '& th, & td': {
            border: '1px solid',
            borderColor: 'divider',
            px: 1.5,
            py: 0.75,
            fontSize: '0.875rem',
            textAlign: 'left',
          },
          '& th': {
            fontWeight: 600,
            bgcolor: isDark ? '#233328' : '#eef4ee',
          },
          '& tr:nth-of-type(even)': {
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
          },
        },

        // Horizontal Rules
        '& hr': {
          border: 'none',
          borderTop: '1px solid',
          borderColor: 'divider',
          my: 2,
        },

        // Links
        '& a': {
          color: 'primary.main',
          textDecoration: 'none',
          fontWeight: 500,
          '&:hover': {
            textDecoration: 'underline',
          },
        },

        ...sx,
      }}
    />
  )
}

export default MarkdownView
