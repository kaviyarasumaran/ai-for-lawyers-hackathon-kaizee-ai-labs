import { RouterProvider } from '@tanstack/react-router'
import CaseProvider from './cases/CaseProvider'
import KnowledgeBaseProvider from './knowledge-base/KnowledgeBaseProvider'
import router from './router/router'
import { ThemeStoreProvider } from './theme/ThemeStore'

function App() {
  return (
    <ThemeStoreProvider>
      <CaseProvider>
        <KnowledgeBaseProvider>
          <RouterProvider router={router} />
        </KnowledgeBaseProvider>
      </CaseProvider>
    </ThemeStoreProvider>
  )
}

export default App
