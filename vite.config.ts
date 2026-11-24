import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5125,
    strictPort: true,
    fs: {
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        '**/.dev.vars',
        '**/.dev.vars.*',
        '**/.wrangler/**',
      ],
    },
    proxy: {
      '^/api/(summary|dashboard|monitors(?:/.*)?|incidents)(?:\\?|$)': {
        target: 'http://127.0.0.1:5525',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (proxyRequest, request) => {
            const origin = request.headers.origin;
            if (!origin) return;
            try {
              const url = new URL(origin);
              if (
                (url.protocol === 'http:' || url.protocol === 'https:') &&
                url.origin === origin &&
                url.host === request.headers.host
              ) {
                proxyRequest.setHeader('Origin', 'http://localhost:5125');
              }
            } catch {
              // Malformed origins are rejected by the Worker.
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
