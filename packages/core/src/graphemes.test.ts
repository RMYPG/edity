import { expect, test } from 'vitest';
import { graphemeCount } from '@edity/core';

test.each([
  ['Fisioterapia', 12],
  ['Fisioterapia 🧑‍⚕️', 14],
  ['José', 4],
  ['🇪🇸', 1],
  ['👍🏽', 1],
  ['a\r\nb', 3],
  ['', 0],
])('graphemeCount counts %j as %i', (value, count) => {
  expect(graphemeCount(value)).toBe(count);
});
