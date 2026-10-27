import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import FolderCopyOutlinedIcon from '@mui/icons-material/FolderCopyOutlined'
import IntegrationInstructionsOutlinedIcon from '@mui/icons-material/IntegrationInstructionsOutlined'

export const caseworkTools = [
  {
    id: 'file-summaries',
    title: 'Summarize case files',
    description: 'Review case documents and bring key facts and issues into focus.',
    prompt: 'Summarize the key facts, issues, and important details in my case files.',
    path: '/casework-tools/file-summaries',
    icon: FolderCopyOutlinedIcon,
    detail:
      'Keep a clear overview of the documents attached to each case and prepare focused summaries for review.',
    emptyTitle: 'No case files to review yet',
    emptyDescription:
      'Create a case and add its documents to organize the materials you want summarized.',
    actionLabel: 'View cases',
  },
  {
    id: 'deadlines',
    title: 'Track deadlines',
    description: 'Keep important dates and upcoming case deadlines visible.',
    prompt: 'Review the case information and identify important deadlines and dates to track.',
    path: '/casework-tools/deadlines',
    icon: EventAvailableOutlinedIcon,
    detail:
      'Collect important dates in one place so upcoming filing, hearing, and response deadlines are easier to track.',
    emptyTitle: 'No deadlines added yet',
    emptyDescription:
      'Add case details or documents to identify dates that need attention.',
    actionLabel: 'View cases',
  },
  {
    id: 'legal-tasks',
    title: 'Extract legal tasks',
    description: 'Turn case details into clear next steps and follow-up tasks.',
    prompt: 'Extract the legal tasks and next steps from my case information.',
    path: '/casework-tools/legal-tasks',
    icon: ChecklistOutlinedIcon,
    detail:
      'Organize action items and follow-ups related to a matter, then review the next steps for each case.',
    emptyTitle: 'No tasks extracted yet',
    emptyDescription:
      'Add case information to start organizing related actions and next steps.',
    actionLabel: 'View cases',
  },
  {
    id: 'integrations',
    title: 'Case management integrations',
    description: 'Explore how your existing case management system could connect.',
    prompt:
      'Explain how this assistant could integrate with my existing case management system.',
    path: '/casework-tools/integrations',
    icon: IntegrationInstructionsOutlinedIcon,
    detail:
      'Plan a workflow between this assistant and your existing case management system. No external system is connected in this demo.',
    emptyTitle: 'No systems connected',
    emptyDescription:
      'Integration setup is not available yet. This page outlines the case-management connection workflow.',
    actionLabel: 'Back to AI Assistant',
  },
]
