import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    // Provides Buffer, process, crypto polyfills needed by @solana/web3.js
    // and @solana/wallet-adapter-* packages.
    nodePolyfills({ include: ['buffer', 'process', 'crypto', 'stream'] }),
  ],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer', '@solana/web3.js'],
  },
});
