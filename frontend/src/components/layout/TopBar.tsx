import { AppBar, Toolbar, IconButton, InputBase, Avatar, Box, Tooltip } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import MenuIcon from '@mui/icons-material/Menu'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAppSelector } from '@/store/hooks'

export default function TopBar() {
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)
  const [keyword, setKeyword] = useState('')

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && keyword.trim()) {
      navigate(`/search?keyword=${encodeURIComponent(keyword.trim())}`)
      setKeyword('')
    }
  }

  return (
    <AppBar
      position="fixed"
      color="inherit"
      sx={{ ml: { md: '240px' }, width: { md: 'calc(100% - 240px)' } }}
    >
      <Toolbar>
        <IconButton sx={{ display: { md: 'none' } }}>
          <MenuIcon />
        </IconButton>

        {/* Search */}
        <Box
          sx={{
            flex: 1,
            mx: 2,
            maxWidth: 480,
            bgcolor: 'action.hover',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            px: 2,
          }}
        >
          <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
          <InputBase
            placeholder="搜索用户、标签..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleSearch}
            sx={{ flex: 1, fontSize: 14 }}
          />
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* User avatar */}
        {user && (
          <Tooltip title={user.nickname}>
            <IconButton onClick={() => navigate('/profile')}>
              <Avatar
                src={user.avatar_url}
                sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}
              >
                {user.nickname?.[0]}
              </Avatar>
            </IconButton>
          </Tooltip>
        )}
      </Toolbar>
    </AppBar>
  )
}
