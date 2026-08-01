import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/a/' : '/',
  build: {
    target: 'es2022',
    sourcemap: mode !== 'production'
  }
}));

// import { defineConfig } from 'vite';

// export default defineConfig({
//   // plugins: [
//     // {
//     //   config(config, { command }) {
//     //     if (command === "build" || command === "preview") {
//     //       return {
//     //         base: "/a/"
//     //       };
//     //     } else {
//     //       return {
//     //         base: "/"
//     //       };
//     //     }
//     //   }
//     // }
//     // ],
//   //     ,
//   //   }
//   // ],
//   optimizeDeps: {
//     include: [
//       '@awesome.me/webawesome'
//     ]
//   },
//   build: {
//     target: 'esnext',
//     minify: 'terser',
//     commonjsOptions: {
//       include: [
//         /@awesome\.me\/webawesome/,
//         /node_modules/
//       ]
//     }
//   },
//   // rollupOptions: {
//   //   treeshake: false,
//     // treeshake: {
//     //   moduleSideEffects: (id) => id.includes('@awesome.me/webawesome')
//     // },
//     // output: {
//     //   manualChunks(id) {
//     //     if (id.includes('node_modules/@awesome.me/webawesome')) {
//     //       return 'v';
//     //     }
//     //   }
//     // }
//   // }
// });
