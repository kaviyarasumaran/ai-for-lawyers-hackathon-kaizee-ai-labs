import { useEffect, useMemo, useState } from 'react'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { ThemeStoreContext } from './ThemeStoreContext'

const themeStorageKey = 'counsel-color-mode'

function getInitialMode() {
  const savedMode = window.localStorage.getItem(themeStorageKey)
  return savedMode === 'dark' ? 'dark' : 'light'
}

function ThemeStoreProvider({ children }) {
  const [mode, setMode] = useState(getInitialMode)

  useEffect(() => {
    window.localStorage.setItem(themeStorageKey, mode)
    document.documentElement.dataset.theme = mode
    document.documentElement.style.colorScheme = mode
  }, [mode])

  const theme = useMemo(
    () =>
      createTheme({
        palette:
          mode === 'dark'
            ? {
                mode: 'dark',
                primary: { main: '#8bb99b', dark: '#6fa184', light: '#263b2e' },
                background: { default: '#121715', paper: '#1b2320' },
                text: { primary: '#e2e8e3', secondary: '#a5b0a7' },
                divider: '#303a34',
              }
            : {
                mode: 'light',
                primary: { main: '#286852', dark: '#1f5943', light: '#e9f1e9' },
                background: { default: '#fbfbf9', paper: '#ffffff' },
                text: { primary: '#303632', secondary: '#858c85' },
                divider: '#eaeae5',
              },
        typography: {
          fontFamily: '"DM Sans", "Segoe UI", sans-serif',
          fontSize: 14,
          h1: {
            fontFamily: 'Manrope, "DM Sans", sans-serif',
            fontSize: 'clamp(2rem, 4vw, 2.75rem)',
            fontWeight: 700,
            lineHeight: 1.15,
          },
          h2: {
            fontFamily: 'Manrope, "DM Sans", sans-serif',
            fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)',
            fontWeight: 700,
            lineHeight: 1.2,
          },
          h3: {
            fontFamily: 'Manrope, "DM Sans", sans-serif',
            fontSize: 'clamp(1.5rem, 3vw, 1.875rem)',
            fontWeight: 700,
            lineHeight: 1.25,
          },
          h4: {
            fontFamily: 'Manrope, "DM Sans", sans-serif',
            fontSize: '1.5rem',
            fontWeight: 700,
            lineHeight: 1.3,
          },
          h5: {
            fontFamily: 'Manrope, "DM Sans", sans-serif',
            fontSize: '1.25rem',
            fontWeight: 700,
            lineHeight: 1.35,
          },
          h6: {
            fontFamily: 'Manrope, "DM Sans", sans-serif',
            fontSize: '1.125rem',
            fontWeight: 700,
            lineHeight: 1.4,
          },
          subtitle1: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
          subtitle2: { fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.5 },
          body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
          body2: { fontSize: '0.875rem', lineHeight: 1.6 },
          button: { fontSize: '0.875rem', textTransform: 'none', fontWeight: 600 },
          caption: { fontSize: '0.75rem', lineHeight: 1.5 },
          overline: {
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            lineHeight: 1.5,
          },
        },
        shape: { borderRadius: 9 },
        components: {
          MuiTypography: {
            defaultProps: { variant: 'body1' },
          },
          MuiButton: {
            styleOverrides: {
              root: { fontSize: '0.875rem' },
            },
          },
          MuiInputBase: {
            styleOverrides: {
              root: { fontSize: '0.875rem' },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: { fontSize: '0.875rem' },
            },
          },
          MuiChip: {
            styleOverrides: {
              label: { fontSize: '0.75rem' },
            },
          },
          MuiCssBaseline: {
            styleOverrides: {
              html: { fontSize: '16px' },
              body: {
                minWidth: 320,
                minHeight: '100vh',
                backgroundColor: mode === 'dark' ? '#121715' : '#fbfbf9',
                fontSize: '1rem',
                lineHeight: 1.5,
              },
              ...(mode === 'dark' && {
                'html, body, #root': {
                  minHeight: '100%',
                  backgroundColor: '#121715',
                  color: '#e2e8e3',
                },
                '#root > .MuiBox-root, #root main': {
                  backgroundColor: '#121715 !important',
                },
                '#root aside': {
                  backgroundColor: '#1b2320',
                },
                '#root header': {
                  borderColor: '#303a34 !important',
                },
                '#root .MuiPaper-root, .MuiPopover-paper, .MuiMenu-paper, .MuiDrawer-paper': {
                  borderColor: '#303a34 !important',
                  backgroundColor: '#1b2320 !important',
                  color: '#e2e8e3',
                },
                '#root .MuiTypography-root': {
                  color: '#d5ddd6 !important',
                },
                '#root .MuiButton-root, #root .MuiIconButton-root, #root .MuiListItemButton-root': {
                  color: '#c0cec3',
                },
                '#root .MuiButton-contained': {
                  backgroundColor: '#286852',
                  color: '#ffffff',
                },
                '#root .MuiInputBase-root, #root .MuiOutlinedInput-root': {
                  backgroundColor: '#202a25 !important',
                  color: '#e2e8e3 !important',
                },
                '#root .MuiInputBase-input, #root .MuiSelect-select, #root .MuiFormLabel-root': {
                  color: '#d5ddd6 !important',
                },
                '#root .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#46534a !important',
                },
                '#root .MuiDivider-root': {
                  borderColor: '#303a34 !important',
                },
                '#root .MuiTableCell-root': {
                  borderColor: '#303a34 !important',
                  color: '#d5ddd6 !important',
                },
                '#root .MuiChip-root': {
                  backgroundColor: '#29372f',
                  color: '#c3d6c7',
                },
                '#root .MuiAlert-root': {
                  backgroundColor: '#202a25',
                  color: '#d5ddd6',
                },
                '#root .MuiSwitch-track': {
                  backgroundColor: '#68756b',
                },
              }),
            },
          },
        },
      }),
    [mode],
  )

  const store = useMemo(
    () => ({
      mode,
      setMode,
      toggleMode: () => setMode((currentMode) => currentMode === 'light' ? 'dark' : 'light'),
    }),
    [mode],
  )

  return (
    <ThemeStoreContext.Provider value={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeStoreContext.Provider>
  )
}

export { ThemeStoreProvider }
