import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Lets the frontend call /api/... in dev without CORS headaches
      '/api': 'http://localhost:4000',
    },
  },
});
