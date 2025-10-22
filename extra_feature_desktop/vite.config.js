import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'renderer',
  base: './',
  server: {
    port: 5174
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});


