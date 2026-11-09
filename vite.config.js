import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const { BACKEND_URL, TTS_URL = 'http://127.0.0.1:7788' } = loadEnv(mode, process.cwd(), '');
  const proxy = {
    '/local-tts': {
      target: TTS_URL,
      rewrite: () => '/v1/tts',
      proxyTimeout: 15000,
    },
    ...(BACKEND_URL ? { '/api': BACKEND_URL } : {}),
  };
  return {
    server: {
      proxy,
      watch: { ignored: ['**/.tts-model/**', '**/..tts-model.tmp/**', '**/.tts-runtime/**'] },
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.tts-model/**', '**/..tts-model.tmp/**', '**/.tts-runtime/**'] },
    },
    preview: { proxy },
  };
});
