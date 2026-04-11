import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    outDir:      '.',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        index:     resolve(__dirname, 'index.html'),
        cadastros: resolve(__dirname, 'cadastros.html'),
        relatorios: resolve(__dirname, 'relatorios.html'),
      },
    },
  },
});
