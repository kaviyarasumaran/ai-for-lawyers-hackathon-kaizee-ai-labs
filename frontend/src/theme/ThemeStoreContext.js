import { createContext, useContext } from 'react'

const ThemeStoreContext = createContext(null)

function useThemeStore() {
  const store = useContext(ThemeStoreContext)
  if (!store) throw new Error('useThemeStore must be used inside ThemeStoreProvider')
  return store
}

export { ThemeStoreContext, useThemeStore }
