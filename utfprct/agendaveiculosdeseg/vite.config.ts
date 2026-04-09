import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    outDir:      '.',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        index:      resolve(__dirname, 'index.html'),
        assistente: resolve(__dirname, 'assistente.html'),
        relatorios: resolve(__dirname, 'relatorios.html'),
        cadastros:  resolve(__dirname, 'cadastros.html'),
      },
    },
  },
});
