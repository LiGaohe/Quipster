import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Typography,
} from '@mui/material'
import { Add } from '@mui/icons-material'
import { useAppDispatch, useAppSelector } from '@/store/hooks'
import { fetchPosts, resetPosts } from '@/store/slices/postsSlice'
import PostCard from '@/components/posts/PostCard'
import CreatePostDialog from '@/components/posts/CreatePostDialog'

const FeedPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { items, loading, hasMore, page } = useAppSelector((state) => state.posts)

  const [dialogOpen, setDialogOpen] = useState(false)

  // sentinel ref for IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  // track whether initial load has been triggered
  const initializedRef = useRef(false)

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return
    dispatch(fetchPosts({ page, limit: 10 }))
  }, [dispatch, loading, hasMore, page])

  // Initial load
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true
      dispatch(resetPosts())
      dispatch(fetchPosts({ page: 1, limit: 10, replace: true }))
    }
  }, [dispatch])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <Container maxWidth="sm" sx={{ py: 3 }}>
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={2}
      >
        <Typography variant="h5" fontWeight={700}>
          动态
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setDialogOpen(true)}
          size="small"
        >
          发布动态
        </Button>
      </Box>

      {/* Posts list */}
      {items.length === 0 && !loading && (
        <Box textAlign="center" py={8}>
          <Typography variant="body1" color="text.secondary">
            暂无动态，快来发布第一条吧！
          </Typography>
        </Box>
      )}

      {items.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      {/* Loading indicator */}
      {loading && (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={28} />
        </Box>
      )}

      {/* No more data */}
      {!hasMore && items.length > 0 && (
        <Box textAlign="center" py={2}>
          <Typography variant="caption" color="text.secondary">
            已经到底了～
          </Typography>
        </Box>
      )}

      {/* Sentinel for IntersectionObserver */}
      <Box ref={sentinelRef} sx={{ height: 1 }} />

      {/* Create Post Dialog */}
      <CreatePostDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Container>
  )
}

export default FeedPage
