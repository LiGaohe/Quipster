import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Avatar, Divider, Button } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import HomeIcon from '@mui/icons-material/Home'
import FavoriteIcon from '@mui/icons-material/Favorite'
import ChatIcon from '@mui/icons-material/Chat'
import GroupsIcon from '@mui/icons-material/Groups'
import EventIcon from '@mui/icons-material/Event'
import LockIcon from '@mui/icons-material/Lock'
import HelpIcon from '@mui/icons-material/Help'
import SchoolIcon from '@mui/icons-material/School'
import StarIcon from '@mui/icons-material/Star'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { logoutUser } from '@/store/slices/authSlice'

const NAV_ITEMS = [
  { label: '首页', path: '/', icon: <HomeIcon /> },
  { label: '匹配', path: '/match', icon: <FavoriteIcon /> },
  { label: '聊天', path: '/chat', icon: <ChatIcon /> },
  { label: '社群', path: '/groups', icon: <GroupsIcon /> },
  { label: '活动', path: '/events', icon: <EventIcon /> },
  { label: '树洞', path: '/anonymous', icon: <LockIcon /> },
  { label: '问答', path: '/questions', icon: <HelpIcon /> },
  { label: '学习搭子', path: '/study', icon: <SchoolIcon /> },
  { label: '信用', path: '/credit', icon: <StarIcon /> },
]

const DRAWER_WIDTH = 240

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)

  const handleLogout = async () => {
    await dispatch(logoutUser())
    navigate('/login')
  }

  const content = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo */}
      <Box sx={{ px: 3, py: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #2196F3, #FF4081)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Q</Typography>
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
          Quipster
        </Typography>
      </Box>

      {/* User info */}
      {user && (
        <Box
          sx={{ px: 2, py: 1.5, mx: 1, borderRadius: 2, bgcolor: 'action.hover', cursor: 'pointer', mb: 1 }}
          onClick={() => navigate('/profile')}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar src={user.avatar_url} sx={{ width: 36, height: 36, bgcolor: 'primary.main' }}>
              {user.nickname?.[0]}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600} noWrap>
                {user.nickname}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                信用分 {user.credit_score}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}

      <Divider sx={{ my: 1 }} />

      {/* Nav items */}
      <List sx={{ flex: 1, px: 1 }}>
        {NAV_ITEMS.map((item) => {
          const active = location.pathname === item.path
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => navigate(item.path)}
                selected={active}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '& .MuiListItemIcon-root': { color: 'white' },
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }} />
              </ListItemButton>
            </ListItem>
          )
        })}

        {/* Admin entry - only visible to admins */}
        {user?.role === 'admin' && (
          <>
            <Divider sx={{ my: 1 }} />
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => navigate('/admin/reports')}
                selected={location.pathname === '/admin/reports'}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'white',
                    '& .MuiListItemIcon-root': { color: 'white' },
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}><AdminPanelSettingsIcon /></ListItemIcon>
                <ListItemText primary="举报审核" primaryTypographyProps={{ fontSize: 14, fontWeight: location.pathname === '/admin/reports' ? 600 : 400 }} />
              </ListItemButton>
            </ListItem>
          </>
        )}
      </List>

      <Divider />
      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          color="inherit"
          sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
        >
          退出登录
        </Button>
      </Box>
    </Box>
  )

  return (
    <Drawer
      variant="permanent"
      sx={{
        display: { xs: 'none', md: 'block' },
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          border: 'none',
          boxShadow: '2px 0 12px rgba(0,0,0,0.06)',
        },
      }}
    >
      {content}
    </Drawer>
  )
}
