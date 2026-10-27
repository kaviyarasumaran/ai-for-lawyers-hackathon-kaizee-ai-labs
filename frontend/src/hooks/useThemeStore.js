import { useContext } from 'react'
import { ThemeStoreContext } from '../context/ThemeStoreContext'

export function useThemeStore() {
  const store = useContext(ThemeStoreContext)
  if (!store) {
    throw new Error('useThemeStore must be used inside ThemeStoreProvider')
  }
  return store
}

export default useThemeStore
