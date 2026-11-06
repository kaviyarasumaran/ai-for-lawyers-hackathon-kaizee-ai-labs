import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import ChatLayout from '../components/chat/ChatLayout'
import ScrollableLayout from '../layouts/ScrollableLayout'
import CasesPage from '../pages/CasesPage'
import CaseworkToolsPage from '../pages/CaseworkToolsPage'
import CaseDetailsPage from '../pages/CaseDetailsPage'
import CaseManagementIntegrationsPage from '../pages/casework-tools/CaseManagementIntegrationsPage'
import DeadlineTrackingPage from '../pages/casework-tools/DeadlineTrackingPage'
import LegalTasksPage from '../pages/casework-tools/LegalTasksPage'
import SummarizeCaseFilesPage from '../pages/casework-tools/SummarizeCaseFilesPage'
import KnowledgeBasePage from '../pages/KnowledgeBasePage'
import JudgmentValidityPage from '../pages/JudgmentValidityPage'
import CauseListPage from '../pages/CauseListPage'
import NotFoundPage from '../pages/NotFoundPage'
import NetworkPage from '../pages/NetworkPage'
import SettingsPage from '../pages/SettingsPage'
import NotificationsPage from '../pages/NotificationsPage'
import MessagesPage from '../pages/MessagesPage'

const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: NotFoundPage,
})

const scrollableLayoutRoute = createRoute({
  id: '_scrollable',
  getParentRoute: () => rootRoute,
  component: ScrollableLayout,
})

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: ChatLayout }),
  createRoute({ getParentRoute: () => rootRoute, path: '/chat/$chatId', component: ChatLayout }),
  createRoute({ getParentRoute: () => rootRoute, path: '/cases/$caseId/chat', component: ChatLayout }),
  createRoute({ getParentRoute: () => rootRoute, path: '/cases/$caseId/chat/$chatId', component: ChatLayout }),
  scrollableLayoutRoute.addChildren([
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/cases', component: CasesPage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/cases/$caseId', component: CaseDetailsPage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/judgment-validity', component: JudgmentValidityPage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/cause-list', component: CauseListPage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/knowledge-base', component: KnowledgeBasePage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/notifications', component: NotificationsPage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/messages', component: MessagesPage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/casework-tools', component: CaseworkToolsPage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/casework-tools/file-summaries', component: SummarizeCaseFilesPage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/casework-tools/deadlines', component: DeadlineTrackingPage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/casework-tools/legal-tasks', component: LegalTasksPage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/casework-tools/integrations', component: CaseManagementIntegrationsPage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/settings', component: SettingsPage }),
    createRoute({ getParentRoute: () => scrollableLayoutRoute, path: '/network', component: NetworkPage }),
  ]),
])

const router = createRouter({ routeTree })

export default router
