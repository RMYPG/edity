// The Editor's own text, in every language it speaks (N6). Its language
// follows the Client's, never the Site's.
import type { Count } from './limits.js';

/** A language the Editor speaks. */
export type Locale = 'es' | 'en';

/** Every text the Editor shows or gives screen readers. */
export interface Messages {
  /** The name of the bar, for screen readers. */
  readonly bar: string;
  /** Who is signed in, shown next to the Client's name. */
  signedInAs(name: string): string;
  /** The Change count. */
  changes(count: number): string;
  readonly discard: string;
  readonly publish: string;
  /** Hides every Editor control, to see the page as a visitor does. */
  readonly visitorView: string;
  /** Leaves the visitor view. */
  readonly backToEditing: string;
  /** A Field's counter: one Limit its value is near or over (L3 to L5). */
  limit(count: Count): string;
  /** A counter on a Field that broke the Limit as published (L7). */
  published(limit: string): string;
}

const numbers = {
  es: new Intl.NumberFormat('es'),
  en: new Intl.NumberFormat('en'),
};

const messages: Readonly<Record<Locale, Messages>> = {
  es: {
    bar: 'Editor de Edity',
    signedInAs: (name) => `Editando como ${name}`,
    changes: (count) =>
      count === 0
        ? 'Sin cambios'
        : count === 1
          ? '1 cambio'
          : `${count} cambios`,
    discard: 'Descartar',
    publish: 'Publicar',
    visitorView: 'Vista de visitante',
    backToEditing: 'Volver a editar',
    limit(count) {
      switch (count.limit) {
        case 'chars':
        case 'lines': {
          const unit = count.limit === 'lines' ? ' líneas' : '';
          const extra = count.count - count.max;
          return `${count.count}/${count.max}${unit}${
            extra <= 0 ? '' : extra === 1 ? ' · sobra 1' : ` · sobran ${extra}`
          }`;
        }
        case 'min':
          return `Mínimo ${numbers.es.format(count.bound)}`;
        case 'max':
          return `Máximo ${numbers.es.format(count.bound)}`;
        case 'decimals':
          return count.max === 0
            ? 'Sin decimales'
            : count.max === 1
              ? 'Máximo 1 decimal'
              : `Máximo ${count.max} decimales`;
      }
    },
    published: (limit) => `${limit} · ya publicado así`,
  },
  en: {
    bar: 'Edity Editor',
    signedInAs: (name) => `Editing as ${name}`,
    changes: (count) =>
      count === 0
        ? 'No changes'
        : count === 1
          ? '1 change'
          : `${count} changes`,
    discard: 'Discard',
    publish: 'Publish',
    visitorView: 'Visitor view',
    backToEditing: 'Back to editing',
    limit(count) {
      switch (count.limit) {
        case 'chars':
        case 'lines': {
          const unit = count.limit === 'lines' ? ' lines' : '';
          const extra = count.count - count.max;
          return `${count.count}/${count.max}${unit}${
            extra <= 0 ? '' : ` · ${extra} too many`
          }`;
        }
        case 'min':
          return `Minimum ${numbers.en.format(count.bound)}`;
        case 'max':
          return `Maximum ${numbers.en.format(count.bound)}`;
        case 'decimals':
          return count.max === 0
            ? 'No decimals'
            : count.max === 1
              ? 'At most 1 decimal'
              : `At most ${count.max} decimals`;
      }
    },
    published: (limit) => `${limit} · already published`,
  },
};

/** The Editor's text in `locale`. */
export function messagesFor(locale: Locale): Messages {
  return messages[locale];
}

/**
 * The Editor's language: the session's locale, else the first of the
 * browser's languages the Editor speaks, else English. Only the language
 * counts, so `es-MX` is `es`.
 */
export function chooseLocale(
  sessionLocale: string | undefined,
  browserLanguages: readonly string[],
): Locale {
  for (const tag of [sessionLocale, ...browserLanguages]) {
    const language = tag?.split(/[-_]/)[0]?.toLowerCase();
    if (language !== undefined && Object.hasOwn(messages, language)) {
      return language as Locale;
    }
  }
  return 'en';
}
