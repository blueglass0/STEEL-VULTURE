import { defineConfig } from 'vitest/config';

// `npm run balance`: regenerates docs/BALANCE.md from the data files (see src/game/balance.ts).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/report/*.report.ts'],
  },
});
