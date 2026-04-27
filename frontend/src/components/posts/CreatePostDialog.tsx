import React, { useRef, useState } from 'react'
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
  Stack,
  LinearProgress,
} from '@mui/material'
import { Close, AddPhotoAlternate, DeleteOutline } from '@mui/icons-material'
import { useAppDispatch } from '@/store/hooks'
import { createPost } from '@/store/slices/postsSlice'
import { supabase } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

interface CreatePostDialogProps {
  open: boolean
  onClose: () => void
}

const MAX_CONTENT = 500
const MAX_IMAGES = 9
const MAX_FILE_SIZE = 5 * 1024 * 1024

const CreatePostDialog: React.FC<CreatePostDialogProps> = ({ open, onClose }) => {
  const dispatch = useAppDispatch()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [content, setContent] = useState('')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleClose = () => {
    if (submitting || uploading) return
    setContent('')
    setImageUrls([])
    setError('')
    onClose()
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (imageUrls.length + files.length > MAX_IMAGES) {
      setError(`最多添加 ${MAX_IMAGES} 张图片`)
      e.target.value = ''
      return
    }

    setUploading(true)
    setUploadProgress(0)
    setError('')

    try {
      const uploadedUrls: string[] = []
      const totalFiles = files.length

      for (let i = 0; i < files.length; i++) {
        const file = files[i]

        if (file.size > MAX_FILE_SIZE) {
          setError(`图片 ${file.name} 超过 5MB 限制`)
          continue
        }

        if (!file.type.startsWith('image/')) {
          setError(`${file.name} 不是有效的图片文件`)
          continue
        }

        const fileExt = file.name.split('.').pop()
        const fileName = `${uuidv4()}.${fileExt}`
        const filePath = `posts/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, file)

        if (uploadError) {
          setError(`上传 ${file.name} 失败: ${uploadError.message}`)
          continue
        }

        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath)

        uploadedUrls.push(publicUrl)
        setUploadProgress(((i + 1) / totalFiles) * 100)
      }

      if (uploadedUrls.length > 0) {
        setImageUrls((prev) => [...prev, ...uploadedUrls])
      }
    } catch (err) {
      setError('上传失败，请重试')
    } finally {
      setUploading(false)
      setUploadProgress(0)
      e.target.value = ''
    }
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
        <Typography component="span" variant="h6" fontWeight={600}>
          发布动态
        </Typography>
        <IconButton size="small" onClick={handleClose} disabled={submitting || uploading}>
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <Box display="flex" alignItems="center" gap={1} mb={1.5}>
          <Button
            variant="outlined"
            startIcon={<AddPhotoAlternate />}
            onClick={handleFileSelect}
            disabled={uploading || submitting || imageUrls.length >= MAX_IMAGES}
            size="small"
          >
            选择图片
          </Button>
          <Typography variant="caption" color="text.secondary">
            {imageUrls.length}/{MAX_IMAGES} 张
          </Typography>
        </Box>

        {uploading && (
          <Box mb={2}>
            <LinearProgress variant="determinate" value={uploadProgress} />
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              上传中... {Math.round(uploadProgress)}%
            </Typography>
          </Box>
        )}

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
                  {url.split('/').pop()}
                </Typography>
                <IconButton size="small" onClick={() => handleRemoveImage(idx)}>
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}

        {error && (
          <Typography variant="caption" color="error" display="block" mt={1}>
            {error}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={handleClose} disabled={submitting || uploading}>
          取消
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || uploading || !content.trim() || isOverLimit}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {submitting ? '发布中...' : '发布'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default CreatePostDialog
