import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  IconButton,
  CircularProgress,
  Chip,
  Stack,
} from '@mui/material'
import { Close, AddPhotoAlternate, DeleteOutline } from '@mui/icons-material'
import { useAppDispatch } from '@/store/hooks'
import { createPost } from '@/store/slices/postsSlice'

interface CreatePostDialogProps {
  open: boolean
  onClose: () => void
}

const MAX_CONTENT = 500
const MAX_IMAGES = 9

const CreatePostDialog: React.FC<CreatePostDialogProps> = ({ open, onClose }) => {
  const dispatch = useAppDispatch()

  const [content, setContent] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [imageInput, setImageInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleClose = () => {
    if (submitting) return
    setContent('')
    setImageUrls([])
    setImageInput('')
    setError('')
    onClose()
  }

  const handleAddImage = () => {
    const trimmed = imageInput.trim()
    if (!trimmed) return
    if (imageUrls.length >= MAX_IMAGES) {
      setError(`最��添加 ${MAX_IMAGES} 张图片`)
      return
    }
    // basic URL validation
    try {
      new URL(trimmed)
    } catch {
      setError('请输入合法的图片 URL')
      return
    }
    setImageUrls((prev) => [...prev, trimmed])
    setImageInput('')
    setError('')
  }

  const handleRemoveImage = (idx: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    const trimmedContent = content.trim()
    if (!trimmedContent) {
      setError('动态内容不能为空')
      return
    }
    if (trimmedContent.length > MAX_CONTENT) {
      setError(`内容不能超过 ${MAX_CONTENT} 字`)
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const result = await dispatch(
        createPost({
          content: trimmedContent,
          images: imageUrls.length > 0 ? imageUrls : undefined,
        })
      )
      if (createPost.fulfilled.match(result)) {
        handleClose()
      } else {
        setError((result.payload as string) || '发布失败，请稍后重试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const remaining = MAX_CONTENT - content.length
  const isOverLimit = content.length > MAX_CONTENT

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          发布动态
        </Typography>
        <IconButton size="small" onClick={handleClose} disabled={submitting}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <TextField
          fullWidth
          multiline
          minRows={4}
          maxRows={10}
          placeholder="分享你此刻的想法..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          variant="outlined"
          inputProps={{ maxLength: MAX_CONTENT + 50 }}
          error={isOverLimit}
          sx={{ mb: 1 }}
        />

        <Box display="flex" justifyContent="flex-end" mb={1}>
          <Typography
            variant="caption"
            color={isOverLimit ? 'error' : remaining <= 50 ? 'warning.main' : 'text.secondary'}
          >
            {content.length}/{MAX_CONTENT}
          </Typography>
        </Box>

        {/* Image URL input */}
        <Box display="flex" alignItems="center" gap={1} mb={1.5}>
          <TextField
            size="small"
            fullWidth
            placeholder="粘贴图片链接（可选）"
            value={imageInput}
            onChange={(e) => setImageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddImage()
              }
            }}
          />
          <IconButton
            color="primary"
            onClick={handleAddImage}
            disabled={!imageInput.trim() || imageUrls.length >= MAX_IMAGES}
            size="small"
          >
            <AddPhotoAlternate />
          </IconButton>
        </Box>

        {imageUrls.length > 0 && (
          <Stack spacing={1} mb={1}>
            {imageUrls.map((url, idx) => (
              <Box
                key={idx}
                display="flex"
                alignItems="center"
                gap={1}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 0.75,
                }}
              >
                <img
                  src={url}
                  alt={`预览${idx + 1}`}
                  style={{
                    width: 48,
                    height: 48,
                    objectFit: 'cover',
                    borderRadius: 4,
                    flexShrink: 0,
                  }}
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {url}
                </Typography>
                <IconButton size="small" onClick={() => handleRemoveImage(idx)}>
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}

        {imageUrls.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            已添加 {imageUrls.length}/{MAX_IMAGES} 张图片
          </Typography>
        )}

        {error && (
          <Typography variant="caption" color="error" display="block" mt={1}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={handleClose} disabled={submitting}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !content.trim() || isOverLimit}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {submitting ? '发布中...' : '发布'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CreatePostDialog
