import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/a/' : '/',
  build: {
    target: 'es2022',
    sourcemap: mode !== 'production',
  },
  // plugins: [
  //   mode === 'production' && {
  //     name: 'remove-console',
  //     transform(code, id) {
  //       if (id.includes('node_modules'))
  //         return null;
  //       if (!id.endsWith('.ts') && !id.endsWith('.js'))
  //         return null;
  //       if (mode !== 'production')
  //         return null;

  //       return {
  //         code: code.replace(/console\.(log|info|warn|debug)\([^;]*\);?/gm, ''),
  //         map: null
  //       };
  //     }
  //   }
  // ]
}));
