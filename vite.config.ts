/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/dot-art-3d-converter/', // For GitHub Pages deployment
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            // Three.js and its dependencies in separate chunk
            if (id.includes('three')) {
              return 'three';
            }
            // React ecosystem
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Router
            if (id.includes('react-router')) {
              return 'router';
            }
            // Other vendor libraries
            return 'vendor';
          }
          
          // Feature-based chunks
          if (id.includes('src/workers')) {
            return 'workers';
          }
          if (id.includes('src/services')) {
            return 'services';
          }
          if (id.includes('src/utils')) {
            return 'utils';
          }
          if (id.includes('src/components/Model3D') || id.includes('src/components/ModelViewer')) {
            return '3d-components';
          }
          if (id.includes('src/components')) {
            return 'components';
          }
          if (id.includes('src/pages')) {
            return 'pages';
          }
        },
        chunkFileNames: (chunkInfo) => {
          return chunkInfo.name === 'vendor' ? 'vendor-[hash].js' : '[name]-[hash].js';
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const extType = info[info.length - 1] || '';
          
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return 'assets/images/[name]-[hash].[ext]';
          }
          if (/woff|woff2|eot|ttf|otf/i.test(extType)) {
            return 'assets/fonts/[name]-[hash].[ext]';
          }
          return 'assets/[name]-[hash].[ext]';
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ['three', 'react', 'react-dom', 'react-router-dom'],
    exclude: ['@vite/client', '@vite/env'],
  },
  server: {
    fs: {
      strict: false,
    },
  },
  worker: {
    format: 'es',
    plugins: [react()],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    reporters: ['verbose'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'dist/',
        'coverage/',
      ],
    },
    // Mock browser APIs
    server: {
      deps: {
        inline: ['three'],
      },
    },
  },
})