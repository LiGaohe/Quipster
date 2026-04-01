import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  type SelectChangeEvent,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { Search } from '@mui/icons-material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { usersApi } from '@/api/users'
import { tagsApi } from '@/api/tags'
import type { UserBasic, UserTag } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADE_OPTIONS = ['大一', '大二', '大三', '大四', '研一', '研二', '研三']

const MAJOR_OPTIONS = [
  '计算机科学与技术',
  '软件工程',
  '电子信息工程',
  '通信工程',
  '机械工程',
  '经济学',
  '金融学',
  '法学',
  '英语',
  '日语',
  '新闻传播学',
  '心理学',
  '其他',
]

const PAGE_SIZE = 12

// ─── UserCard ─────────────────────────────────────────────────────────────────

interface UserCardProps {
  user: UserBasic & { tags?: UserTag[] }
  onClick: () => void
}

const UserCard: React.FC<UserCardProps> = ({ user, onClick }) => {
  const visibleTags = user.tags ? user.tags.slice(0, 3) : []

  return (
    <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
      <CardActionArea onClick={onClick}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar
              src={user.avatar_url}
              alt={user.nickname}
              sx={{ width: 52, height: 52, fontSize: 20 }}
            >
              {user.nickname?.[0]?.toUpperCase()}
            </Avatar>

            <Box flex={1} minWidth={0}>
              <Typography variant="subtitle1" fontWeight={600} noWrap>
                {user.nickname}
              </Typography>

              <Box display="flex" gap={0.75} flexWrap="wrap" mt={0.25} alignItems="center">
                {user.major && (
                  <Typography variant="caption" color="text.secondary">
                    {user.major}
                  </Typography>
                )}
                {user.major && user.grade && (
                  <Typography variant="caption" color="text.secondary">
                    ·
                  </Typography>
                )}
                {user.grade && (
                  <Typography variant="caption" color="text.secondary">
                    {user.grade}
                  </Typography>
                )}
              </Box>

              {visibleTags.length > 0 && (
                <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.75}>
                  {visibleTags.map((tag) => (
                    <Chip
                      key={tag.tag_id}
                      label={tag.tag_name}
                      size="small"
                      variant="outlined"
                      sx={{ height: 20, fontSize: 11 }}
                    />
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

// ─── SearchPage ───────────────────────────────────────────────────────────────

const SearchPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read initial keyword from URL query
  const [keyword, setKeyword] = useState(searchParams.get('keyword') ?? '')
  const [major, setMajor] = useState('')
  const [grade, setGrade] = useState('')
  const [page, setPage] = useState(1)

  const [results, setResults] = useState<UserBasic[]>([])
  const [userTagsMap, setUserTagsMap] = useState<Record<string, UserTag[]>>({})
  const [loading, setLoading] = useState(false)
  const [totalPages, setTotalPages] = useState(0)
  const [searched, setSearched] = useState(false)

  // Keep latest filter values in a ref for debounce closure
  const filtersRef = useRef({ keyword, major, grade })

  // ── Search function ──
  const doSearch = useCallback(async (nextPage: number) => {
    const { keyword: kw, major: mj, grade: gr } = filtersRef.current
    setLoading(true)
    try {
      const res = await usersApi.searchUsers({
        keyword: kw.trim() || undefined,
        major: mj || undefined,
        grade: gr || undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      })
      const users = res.data.data ?? []
      setResults(users)
      const pag = res.data.pagination
      setTotalPages(pag?.pages ?? 0)
      setSearched(true)

      // Fetch tags for each user (fire-and-forget, best effort)
      users.forEach((u) => {
        tagsApi
          .getUserTags(u.id)
          .then((tagRes) => {
            if (tagRes.data.success && tagRes.data.data) {
              setUserTagsMap((prev) => ({ ...prev, [u.id]: tagRes.data.data! }))
            }
          })
          .catch(() => undefined)
      })
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Debounce on keyword / major / grade change ──
  useEffect(() => {
    filtersRef.current = { keyword, major, grade }
    setPage(1)

    // Sync keyword to URL
    const newParams = new URLSearchParams(searchParams)
    if (keyword.trim()) {
      newParams.set('keyword', keyword.trim())
    } else {
      newParams.delete('keyword')
    }
    setSearchParams(newParams, { replace: true })

    const timer = setTimeout(() => {
      doSearch(1)
    }, 300)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword, major, grade])

  // ── Page change ──
  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value)
    doSearch(value)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={2}>
        搜索用户
      </Typography>

      {/* Filters */}
      <Stack spacing={1.5} mb={3}>
        <TextField
          fullWidth
          size="small"
          placeholder="搜索昵称或关键词..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />

        <Box display="flex" gap={1.5}>
          <FormControl size="small" fullWidth>
            <InputLabel>专业</InputLabel>
            <Select
              value={major}
              label="专业"
              onChange={(e: SelectChangeEvent) => setMajor(e.target.value)}
            >
              <MenuItem value="">全部专业</MenuItem>
              {MAJOR_OPTIONS.map((m) => (
                <MenuItem key={m} value={m}>
                  {m}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel>年级</InputLabel>
            <Select
              value={grade}
              label="年级"
              onChange={(e: SelectChangeEvent) => setGrade(e.target.value)}
            >
              <MenuItem value="">全部年级</MenuItem>
              {GRADE_OPTIONS.map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Stack>

      {/* Loading */}
      {loading && (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      )}

      {/* Empty state */}
      {!loading && searched && results.length === 0 && (
        <Box textAlign="center" py={8}>
          <Typography variant="body1" color="text.secondary">
            没有找到匹配的用户
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            换个关键词试试吧
          </Typography>
        </Box>
      )}

      {/* Initial empty state (not yet searched) */}
      {!loading && !searched && (
        <Box textAlign="center" py={8}>
          <Search sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body1" color="text.secondary">
            输入关键词开始搜索
          </Typography>
        </Box>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <>
          <Typography variant="caption" color="text.secondary" mb={1.5} display="block">
            共找到 {totalPages * PAGE_SIZE} 位用户（约）
          </Typography>
          <Stack spacing={1.5}>
            {results.map((user) => (
              <UserCard
                key={user.id}
                user={{ ...user, tags: userTagsMap[user.id] }}
                onClick={() => navigate(`/profile/${user.id}`)}
              />
            ))}
          </Stack>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={3}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
                shape="rounded"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  )
}

export default SearchPage
