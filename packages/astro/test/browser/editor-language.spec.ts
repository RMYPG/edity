// N6: the Editor's text is in Spanish or English, following the Client's
// locale, then the browser's, then English.
import type { Locator } from '@playwright/test';
import { ana, expect, keepDraft, test } from './editor.js';

/**
 * Every text the Editor shows or gives screen readers, in document order:
 * its text nodes and its labelling attributes.
 */
function editorText(editor: Locator): Promise<string[]> {
  return editor.evaluate((host) => {
    const texts: string[] = [];
    const walker = document.createTreeWalker(
      host.shadowRoot!,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    );
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node instanceof Text) {
        if (node.data.trim() !== '') texts.push(node.data.trim());
        continue;
      }
      for (const name of ['aria-label', 'title', 'alt', 'placeholder']) {
        const value = (node as Element).getAttribute(name);
        if (value) texts.push(value);
      }
    }
    return texts;
  });
}

const languages = [
  {
    locale: 'es',
    bar: [
      'Editor de Edity',
      'Editando como Ana',
      'A',
      'Ana',
      'Sin cambios',
      'Descartar',
      'Publicar',
      'Vista de móvil',
      'Vista de visitante',
    ],
    notice: ['1 cambio ya no se aplica', 'Entendido'],
    preview: 'Vista de móvil',
    visitorView: ['Volver a editar'],
  },
  {
    locale: 'en',
    bar: [
      'Edity Editor',
      'Editing as Ana',
      'A',
      'Ana',
      'No changes',
      'Discard',
      'Publish',
      'Phone preview',
      'Visitor view',
    ],
    notice: ['1 change no longer applies', 'OK'],
    preview: 'Phone preview',
    visitorView: ['Back to editing'],
  },
];

for (const {
  locale,
  bar: barText,
  notice,
  preview,
  visitorView,
} of languages) {
  test(`with the session locale "${locale}", all the Editor's text is in that language`, async ({
    page,
    openEditor,
    editor,
    bar,
    isMobile,
  }) => {
    // A Draft kept with a Change to a Field the page no longer has, which
    // the Editor drops and tells the Client about (P2).
    await keepDraft(page, [
      { path: 'hero.subtitle', before: 'En tu casa', after: 'Cerca de ti' },
    ]);
    await openEditor({ session: { ...ana, locale } });

    await expect(editor.locator('[lang]')).toHaveAttribute('lang', locale);
    expect(await editorText(editor)).toEqual([...barText, ...notice]);

    // A phone has no phone preview.
    if (!isMobile) {
      await bar.getByRole('button', { name: preview }).click();
      await expect(editor.locator('iframe')).toBeVisible();
      // The frame's title names it.
      expect(await editorText(editor)).toEqual([
        ...barText,
        ...notice,
        preview,
      ]);
      await bar.getByRole('button', { name: preview }).click();
    }

    await bar.getByRole('button', { name: barText.at(-1) }).click();
    await expect(bar).toHaveCount(0);

    expect(await editorText(editor)).toEqual(visitorView);
  });
}

test.describe('in a browser set to Spanish', () => {
  test.use({ locale: 'es-ES' });

  test('a session locale the Editor does not speak falls back to the browser language', async ({
    openEditor,
    bar,
  }) => {
    await openEditor({ session: { ...ana, locale: 'fr' } });

    await expect(bar).toHaveAccessibleName('Editor de Edity');
  });
});

test.describe('in a browser set to German', () => {
  test.use({ locale: 'de-DE' });

  test('with neither language spoken, the Editor is in English', async ({
    openEditor,
    bar,
  }) => {
    await openEditor({ session: { ...ana, locale: 'fr' } });

    await expect(bar).toHaveAccessibleName('Edity Editor');
  });
});
