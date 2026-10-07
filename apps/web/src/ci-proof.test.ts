// M2.1 proof only: a test that must fail, so the check is seen going red. Removed next commit.
import { expect, test } from 'vitest';

test('deliberately broken', () => {
  expect(1 + 1).toBe(3);
});
