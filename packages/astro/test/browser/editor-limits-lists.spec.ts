// Limits (L1 to L7) on the Fields of Items the Client adds, moves and
// removes (S1 to S6): ticket 12's checks follow ticket 13's Items.
import type { Locator } from '@playwright/test';
import { caretAtEnd, expect, field, focusField, red, test } from './editor.js';

/** Whether the counter `counter` sits just below `element`. */
async function below(counter: Locator, element: Locator): Promise<boolean> {
  const field = (await element.boundingBox())!;
  const badge = (await counter.boundingBox())!;
  return Math.abs(badge.y - (field.y + field.height + 6)) <= 2;
}

test('a new Item’s Field over its Limit turns red and keeps Publish disabled, as it moves, goes and comes back', async ({
  page,
  openEditor,
  editor,
  bar,
}) => {
  await openEditor();
  const publish = bar.getByRole('button', { name: 'Publicar' });
  const over = editor.locator('.counter.over');
  const add = editor.getByRole('button', {
    name: 'Añadir elemento',
    exact: true,
  });
  await focusField(page, 'services.0');

  await add.click();
  await expect(field(page, 'services.4')).toBeFocused();
  await page.keyboard.type('Masaje');
  await expect(publish).toBeEnabled();

  // 48 visible characters, over the 40 a service takes.
  const long = 'Fisioterapia respiratoria y neurológica infantil';
  // The controls name an Item by its first 39 characters.
  const named = `${long.slice(0, 39)}…`;
  await add.click();
  await expect(field(page, 'services.5')).toBeFocused();
  await page.keyboard.type(long);
  await expect(field(page, 'services.5')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(field(page, 'services.5')).toHaveCSS('outline-color', red);
  await expect(over).toHaveCount(1);
  await expect(over).toContainText('48/40 · sobran 8');
  await expect(publish).toBeDisabled();

  // Moved up, it is still the red one, renumbered, with its counter.
  await editor.getByRole('button', { name: `Subir «${named}»` }).click();
  await expect(field(page, 'services.4')).toHaveText(long);
  await expect(field(page, 'services.4')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(field(page, 'services.5')).toHaveText('Masaje');
  await expect(field(page, 'services.5')).not.toHaveAttribute('aria-invalid');
  await expect(over).toHaveCount(1);
  await expect.poll(() => below(over, field(page, 'services.4'))).toBe(true);
  await expect(publish).toBeDisabled();

  // Removed, nothing is over a Limit, and the List is still a Change.
  await editor.getByRole('button', { name: `Quitar «${named}»` }).click();
  await expect(over).toHaveCount(0);
  await expect(page.locator('[data-edity-limit]')).toHaveCount(0);
  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  await expect(publish).toBeEnabled();

  // Undo brings it back, red.
  await editor.getByRole('button', { name: 'Deshacer' }).click();
  await expect(field(page, 'services.4')).toHaveText(long);
  await expect(field(page, 'services.4')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(over).toHaveCount(1);
  await expect(publish).toBeDisabled();
});

test('a new Item’s number Field out of its range keeps Publish disabled', async ({
  page,
  openEditor,
  editor,
  bar,
}) => {
  await openEditor();
  const publish = bar.getByRole('button', { name: 'Publicar' });
  const over = editor.locator('.counter.over');
  await focusField(page, 'plans.1.name');
  await editor
    .getByRole('button', { name: 'Añadir elemento', exact: true })
    .click();
  await expect(field(page, 'plans.2.name')).toBeFocused();

  // From 0 to 999.
  await page.keyboard.type('Familiar');
  await page.keyboard.press('Tab');
  await page.keyboard.type('1000');
  await page.keyboard.press('Tab');
  await page.keyboard.type('Para toda la familia');
  await expect(field(page, 'plans.2.price')).toHaveCSS('outline-color', red);
  await expect(over).toHaveText('Máximo 999');
  await expect(publish).toBeDisabled();

  const price = field(page, 'plans.2.price');
  await price.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('99');
  await expect(over).toHaveCount(0);
  await expect(publish).toBeEnabled();
});

test('a built Item’s Field over its Limit stays red when the Item moves', async ({
  page,
  openEditor,
  editor,
  bar,
}) => {
  await openEditor();
  const publish = bar.getByRole('button', { name: 'Publicar' });
  const over = editor.locator('.counter.over');
  // 24 visible characters at most.
  const name = await focusField(page, 'plans.0.name');
  await caretAtEnd(name);
  await page.keyboard.type(' con muchas sesiones');
  await expect(over).toHaveCount(1);
  await expect(publish).toBeDisabled();

  await editor
    .getByRole('button', { name: 'Bajar «Básico con muchas sesiones»' })
    .click();

  await expect(field(page, 'plans.1.name')).toHaveText(
    'Básico con muchas sesiones',
  );
  await expect(field(page, 'plans.1.name')).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(field(page, 'plans.0.name')).not.toHaveAttribute('aria-invalid');
  await expect(bar.getByRole('status')).toHaveText('1 cambio');
  await expect(over).toHaveCount(1);
  await expect.poll(() => below(over, field(page, 'plans.1.name'))).toBe(true);
  await expect(publish).toBeDisabled();
});
