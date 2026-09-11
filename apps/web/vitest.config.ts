import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// `server-only` (used by src/lib/session.ts, TAPS-5.0.5) unconditionally
// throws from its default `index.js` — Next's webpack build swaps it for
// a real no-op (`empty.js`) via a `react-server` export condition it sets
// itself, but plain Vite/vitest doesn't set that condition, so importing
// it here throws at test time. Aliasing straight to `empty.js` (resolved
// via `require.resolve`, not a hardcoded relative path, since the exact
// hoisted install location isn't guaranteed) reproduces the same no-op
// Next's build would give it, without changing module resolution for
// anything else the way a blanket `resolve.conditions: ['react-server']`
// would.
const require = createRequire(import.meta.url);
const serverOnlyEmptyPath = require.resolve('server-only').replace(/index\.js$/, 'empty.js');

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': serverOnlyEmptyPath,
    },
  },
});
