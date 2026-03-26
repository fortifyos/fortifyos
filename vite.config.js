import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const isPages = process.env.DEPLOY_TARGET === 'pages';

  return {
    base: isPages ? '/fortifyos/' : '/',
    server: {
      host: '127.0.0.1',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'logo192.png', 'logo512.png', 'robots.txt'],
        manifest: {
          name: 'FORTIFY OS: Sovereign Terminal',
          short_name: 'FORTIFY OS',
          description: 'Architecting an Everlasting Foundation.',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '.',
          scope: '.',
          icons: [
            { src: 'logo192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: 'logo512.png', sizes: '512x512', type: 'image/png' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,txt,woff2}'],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true
        }
      })
    ]
  };
});
