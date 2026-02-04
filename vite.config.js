import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg', 'robots.txt'],
      // Disable during development to avoid issues
      devOptions: {
        enabled: false
      },
      manifest: {
        name: 'Learning Management System',
        short_name: 'LMS',
        description: 'A comprehensive learning management system for educators and students',
        theme_color: '#2563eb',
        background_color: '#f9fafb',
        display: 'standalone',
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        // Cache static assets with Cache-First strategy
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Increase the maximum file size that can be precached (default is 2MB)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        runtimeCaching: [
          {
            // Cache-First for static assets (images, fonts, etc.)
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            // Network-First for API calls with offline fallback
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // Network-First for Supabase storage (course content)
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'storage-cache',
              networkTimeoutSeconds: 15,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 14 // 14 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        // Skip waiting and claim clients immediately
        skipWaiting: true,
        clientsClaim: true
      }
    })
  ],
  // Build optimizations
  build: {
    // Enable code splitting
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['@hello-pangea/dnd', 'quill']
        }
      }
    },
    // Generate sourcemaps for production debugging
    sourcemap: false,
    // Optimize chunk size
    chunkSizeWarningLimit: 500
  }
})
