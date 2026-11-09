import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const { BACKEND_URL } = loadEnv(mode, process.cwd(), '');
  return { server: { proxy: BACKEND_URL ? { '/api': BACKEND_URL } : undefined } };
});
