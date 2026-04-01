import { Box, CircularProgress } from '@mui/material'

interface Props {
  minHeight?: string | number
}

export default function LoadingSpinner({ minHeight = '200px' }: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
      }}
    >
      <CircularProgress size={36} />
    </Box>
  )
}
