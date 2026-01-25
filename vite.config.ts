import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: '/',
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      __BUILD_ID__: JSON.stringify(
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.GIT_COMMIT_SHA ||
        Date.now().toString()
      ),
    },
    server: {
      proxy: {
        '/supabase': {
          target: env.VITE_SUPABASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/supabase/, ''),
          secure: true,
        },
      },
    },
  };
});
