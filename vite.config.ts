import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy MCP requests to avoid CORS issues
      '/api/mcp': {
        target: process.env.MCP_SERVER_URL || 'https://strava-mcp-server.onrender.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mcp/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('MCP proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('MCP proxy request:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('MCP proxy response:', proxyRes.statusCode, req.url);
          });
        },
      },
      // Proxy intelligent chat API to a Node.js server (if running separately)
      '/api/chat-intelligent': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Chat API proxy error:', err);
          });
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
