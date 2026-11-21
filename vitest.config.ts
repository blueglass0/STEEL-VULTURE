import { defineConfig } from 'vitest/config';

// Unit tests cover the pure modules (career rules, saves, settings, map generation, loadouts,
// damage, data). Nothing here imports Phaser; gameplay in the browser is checked by playtests.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
  },
});
