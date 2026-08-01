import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/a/' : '/',
  build: {
    target: 'es2022',
    sourcemap: mode !== 'production'
  }
}));
