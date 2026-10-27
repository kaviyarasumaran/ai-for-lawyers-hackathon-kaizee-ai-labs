import { useState } from 'react'
import { Box, Chip, Paper, Tab, Tabs, Typography } from '@mui/material'
import AlternateEmailOutlinedIcon from '@mui/icons-material/AlternateEmailOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined'
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined'

const notificationTabs = [
  { id: 'messages', label: 'Messages', icon: AlternateEmailOutlinedIcon },
  { id: 'announcements', label: 'Announcements', icon: CampaignOutlinedIcon },
  { id: 'tasks', label: 'Agent tasks', icon: AutoAwesomeOutlinedIcon },
  { id: 'billing', label: 'Billing', icon: CreditCardOutlinedIcon },
]

const notificationsByTab = {
  messages: [
    {
      id: 'message-1',
      title: 'New message from Priya Sharma',
      description: '“I have added my notes to the case workspace. Please take a look when you have a moment.”',
      time: 'Today · 10:42 AM',
      status: 'New',
    },
    {
      id: 'message-2',
      title: 'New message from Arjun Mehta',
      description: '“Can we review the document checklist before the next client meeting?”',
      time: 'Yesterday · 4:18 PM',
      status: 'New',
    },
  ],
  announcements: [
    {
      id: 'announcement-1',
      title: 'Workspace updates are here',
      description: 'Case access controls and the shared knowledge base are available in your workspace.',
      time: 'Oct 22 · 9:00 AM',
      status: 'Workspace',
    },
    {
      id: 'announcement-2',
      title: 'Keep case details up to date',
      description: 'Add relevant documents and case notes to help your team stay aligned.',
      time: 'Oct 18 · 11:30 AM',
      status: 'Tip',
    },
  ],
  tasks: [
    {
      id: 'task-1',
      title: 'Case file summary is ready',
      description: 'A sample summary for “Property dispute” has finished processing.',
      time: 'Today · 9:16 AM',
      status: 'Completed',
    },
    {
      id: 'task-2',
      title: 'Deadline review completed',
      description: 'The sample review found two dates to verify against the source documents.',
      time: 'Yesterday · 2:05 PM',
      status: 'Completed',
    },
  ],
  billing: [
    {
      id: 'billing-1',
      title: 'Monthly plan renewal',
      description: 'Your sample workspace plan is scheduled to renew on November 1.',
      time: 'Oct 24',
      status: 'Upcoming',
    },
    {
      id: 'billing-2',
      title: 'Invoice available',
      description: 'A sample invoice for the current billing period is ready to view.',
      time: 'Oct 1',
      status: 'Paid',
    },
  ],
}

function NotificationList({ notifications }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: 'hidden',
        borderColor: 'divider',
        borderRadius: 2.5,
        bgcolor: 'background.paper',
        boxShadow: 'none',
      }}
    >
      {notifications.map((notification, index) => (
        <Box
          key={notification.id}
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            p: { xs: 1.75, sm: 2.25 },
            borderBottom: index < notifications.length - 1 ? '1px solid' : 0,
            borderColor: 'divider',
          }}
        >
          <Box
            aria-hidden="true"
            sx={{
              display: 'grid',
              width: 38,
              height: 38,
              flex: 'none',
              placeItems: 'center',
              borderRadius: 2,
              color: 'primary.main',
              bgcolor: 'action.hover',
            }}
          >
            <NotificationsNoneOutlinedIcon sx={{ fontSize: 19 }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
              <Typography sx={{ color: 'text.primary', fontSize: 'body2.fontSize', fontWeight: 600 }}>
                {notification.title}
              </Typography>
              <Chip label={notification.status} size="small" sx={{ height: 21, fontSize: 'caption.fontSize' }} />
            </Box>
            <Typography sx={{ mt: 0.5, color: 'text.secondary', fontSize: 'body2.fontSize', lineHeight: 1.6 }}>
              {notification.description}
            </Typography>
            <Typography sx={{ mt: 0.75, color: 'text.secondary', fontSize: 'caption.fontSize' }}>
              {notification.time}
            </Typography>
          </Box>
        </Box>
      ))}
    </Paper>
  )
}

function NotificationCenter() {
  const [activeTab, setActiveTab] = useState('messages')
  const activeNotifications = notificationsByTab[activeTab]

  return (
    <Box>
      <Paper
        variant="outlined"
        sx={{
          mb: 2,
          borderColor: 'divider',
          borderRadius: 2.5,
          bgcolor: 'background.paper',
          boxShadow: 'none',
        }}
      >
        <Tabs
          aria-label="Notification categories"
          onChange={(_, value) => setActiveTab(value)}
          scrollButtons="auto"
          value={activeTab}
          variant="scrollable"
          sx={{
            px: { xs: 1, sm: 1.5 },
            '& .MuiTab-root': { minHeight: 54, minWidth: 'auto', px: { xs: 1.25, sm: 2 }, fontSize: 'body2.fontSize' },
          }}
        >
          {notificationTabs.map(({ id, label, icon: Icon }) => (
            <Tab
              key={id}
              icon={<Icon sx={{ fontSize: 18 }} />}
              iconPosition="start"
              label={label}
              value={id}
            />
          ))}
        </Tabs>
      </Paper>
      <NotificationList notifications={activeNotifications} />
      <Typography sx={{ mt: 1.5, color: 'text.secondary', fontSize: 'caption.fontSize' }}>
        Sample notifications for interface preview. No real messages, agent tasks, or billing events are connected.
      </Typography>
    </Box>
  )
}

export default NotificationCenter
