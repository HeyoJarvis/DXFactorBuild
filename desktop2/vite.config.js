import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, 'renderer2'),
  base: './',
  build: {
    outDir: path.join(__dirname, 'renderer2/dist'),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'renderer2/src'),
      '@components': path.resolve(__dirname, 'renderer2/src/components'),
      '@hooks': path.resolve(__dirname, 'renderer2/src/hooks'),
      '@store': path.resolve(__dirname, 'renderer2/src/store'),
      '@styles': path.resolve(__dirname, 'renderer2/src/styles')
    }
  }
});

