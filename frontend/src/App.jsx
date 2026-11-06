import { RouterProvider } from '@tanstack/react-router'
import CaseProvider from './cases/CaseProvider'
import router from './router/router'
import { ThemeStoreProvider } from './store'

function App() {
  return (
    <ThemeStoreProvider>
      <CaseProvider>
        <RouterProvider router={router} />
      </CaseProvider>
    </ThemeStoreProvider>
  )
}

export default App
