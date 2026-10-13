// M2.2 proof only: a red commit on main must not deploy. Removed next commit.
import { expect, test } from 'vitest';

test('deliberately broken', () => {
  expect(1 + 1).toBe(3);
});
