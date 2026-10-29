import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    assetsDir: 'assets',
    // no inline assets/scripts → compatible with CSP script-src 'self'
    assetsInlineLimit: 0,
    modulePreload: { polyfill: false },
  },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:3102' } },
});
