import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'configure-cross-origin-isolation-headers',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
          next();
        });
      },
    },
  ],
  build: {
    cssCodeSplit: false
  },
  base: command === 'build' ? '/a/' : '/'
});
