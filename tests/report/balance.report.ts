import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { balanceReport } from '../../src/game/balance';

// Run with `npm run balance`: writes docs/BALANCE.md. Not part of `npm test`.
it('writes the balance report', () => {
  writeFileSync('docs/BALANCE.md', balanceReport() + '\n');
});
