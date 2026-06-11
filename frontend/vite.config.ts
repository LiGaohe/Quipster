import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/functions': {
        target: 'https://atvnnhjlouscahugvsee.supabase.co',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    // 代码分割优化
    rollupOptions: {
      output: {
        manualChunks: {
          // React 核心库单独打包
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // MUI 单独打包
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          // Redux 单独打包
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          // Supabase 单独打包
          'vendor-supabase': ['@supabase/supabase-js'],
          // 其他工具库
          'vendor-utils': ['axios', 'date-fns', 'uuid'],
        },
      },
    },
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境移除 console
        drop_debugger: true,
      },
    },
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 500,
  },
})
