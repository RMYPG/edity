// The Editor's own text, in every language it speaks (N6). Its language
// follows the Client's, never the Site's.
import { listMessages, type ListMessages } from './lists-i18n.js';

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
  /** The List controls' text. */
  readonly lists: ListMessages;
}

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
    lists: listMessages.es,
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
    lists: listMessages.en,
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
