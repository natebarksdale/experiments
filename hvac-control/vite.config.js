import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Copy data files to public directory
    {
      name: 'copy-data-files',
      buildStart() {
        const dataDir = resolve(__dirname, '../data');
        const publicDataDir = resolve(__dirname, 'public/data');

        // Create public/data directory if it doesn't exist
        if (!existsSync(publicDataDir)) {
          mkdirSync(publicDataDir, { recursive: true });
        }

        // Copy temperature readings if it exists
        const tempReadingsFile = resolve(dataDir, 'temperature-readings.json');
        if (existsSync(tempReadingsFile)) {
          copyFileSync(tempReadingsFile, resolve(publicDataDir, 'temperature-readings.json'));
          console.log('Copied temperature-readings.json to public/data');
        }

        // Copy control log if it exists
        const controlLogFile = resolve(dataDir, 'hvac-control-log.json');
        if (existsSync(controlLogFile)) {
          copyFileSync(controlLogFile, resolve(publicDataDir, 'hvac-control-log.json'));
          console.log('Copied hvac-control-log.json to public/data');
        } else {
          // Create empty log file if it doesn't exist
          const emptyLog = { logs: [] };
          writeFileSync(resolve(publicDataDir, 'hvac-control-log.json'), JSON.stringify(emptyLog, null, 2));
          console.log('Created empty hvac-control-log.json');
        }
      }
    }
  ],
  base: mode === 'production' ? '/experiments/hvac-control/' : '/',
  server: {
    // Proxy API requests during development
    proxy: {
      '/api/hvac': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy, options) => {
          // This would require a separate API server running on port 3001
          // For now, we'll just return a message
        }
      }
    }
  }
}))
