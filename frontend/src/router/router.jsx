import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import ChatLayout from '../components/chat/ChatLayout'
import CasesPage from '../pages/CasesPage'
import CaseworkToolsPage from '../pages/CaseworkToolsPage'
import CaseDetailsPage from '../pages/CaseDetailsPage'
import CaseManagementIntegrationsPage from '../pages/casework-tools/CaseManagementIntegrationsPage'
import DeadlineTrackingPage from '../pages/casework-tools/DeadlineTrackingPage'
import LegalTasksPage from '../pages/casework-tools/LegalTasksPage'
import SummarizeCaseFilesPage from '../pages/casework-tools/SummarizeCaseFilesPage'
import KnowledgeBasePage from '../pages/KnowledgeBasePage'
import NotFoundPage from '../pages/NotFoundPage'
import NetworkPage from '../pages/NetworkPage'
import SettingsPage from '../pages/SettingsPage'
import NotificationsPage from '../pages/NotificationsPage'
import MessagesPage from '../pages/MessagesPage'

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFoundPage,
})

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: ChatLayout }),
  createRoute({ getParentRoute: () => rootRoute, path: '/chat/$chatId', component: ChatLayout }),
  createRoute({ getParentRoute: () => rootRoute, path: '/cases', component: CasesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/cases/$caseId', component: CaseDetailsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/cases/$caseId/chat', component: ChatLayout }),
  createRoute({ getParentRoute: () => rootRoute, path: '/cases/$caseId/chat/$chatId', component: ChatLayout }),
  createRoute({ getParentRoute: () => rootRoute, path: '/knowledge-base', component: KnowledgeBasePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/notifications', component: NotificationsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/messages', component: MessagesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/casework-tools', component: CaseworkToolsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/casework-tools/file-summaries', component: SummarizeCaseFilesPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/casework-tools/deadlines', component: DeadlineTrackingPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/casework-tools/legal-tasks', component: LegalTasksPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/casework-tools/integrations', component: CaseManagementIntegrationsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/network', component: NetworkPage }),
])

const router = createRouter({ routeTree })

export default router
