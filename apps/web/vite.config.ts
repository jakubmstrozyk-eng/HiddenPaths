import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the web app runs on its own port and sends /api calls to the local game server.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8787' } },
});
