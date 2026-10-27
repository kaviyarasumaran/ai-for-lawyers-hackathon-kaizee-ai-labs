import { RouterProvider } from '@tanstack/react-router'
import CaseProvider from './cases/CaseProvider'
import { KnowledgeBaseProvider } from './components/knowledge-base'
import router from './router/router'
import { ThemeStoreProvider } from './store'

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
