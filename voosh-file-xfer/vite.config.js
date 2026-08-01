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
      config(config, { command }) {
        if (command === "build" || command === "preview") {
          return {
            base: "/a/"
          };
        } else {
          return {
            base: "/"
          };
        }
      }
    }
  ],
  optimizeDeps: {
    include: [
      '@awesome.me/webawesome'
    ]
  },
  build: {
    commonjsOptions: {
      include: [
        /@awesome\.me\/webawesome/,
        /node_modules/
      ]
    },
    rollupOptions: {
      treeshake: {
        moduleSideEffects: (id) => id.includes('@awesome.me/webawesome')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@awesome.me/webawesome')) {
            return 'v';
          }
        }
      }
    }
  }
});
