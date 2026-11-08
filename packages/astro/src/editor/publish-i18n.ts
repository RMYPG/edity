// The Editor's text about a Publish and its progress, in every language it
// speaks (N6). i18n.ts gives it to the Editor as `t.publishing`.
import type { Locale } from './i18n.js';
import type { ShownStage } from './publishing.js';

/** Every text about a Publish that the Editor shows or gives screen readers. */
export interface PublishMessages {
  /** The Publish button's text while the Draft is on its way. */
  readonly sending: string;
  /** Each stage a Publish goes through (P4). */
  readonly stages: Readonly<Record<ShownStage, string>>;
  /** The name of the progress of the Publish of `version`. */
  progress(version: string): string;
}

export const publishMessages: Readonly<Record<Locale, PublishMessages>> = {
  es: {
    sending: 'Publicando…',
    stages: {
      validating: 'Validando',
      releasing: 'Creando la versión',
      released: 'Versión creada',
      failed: 'Ha fallado',
    },
    progress: (version) => `Publicación de la versión ${version}`,
  },
  en: {
    sending: 'Publishing…',
    stages: {
      validating: 'Validating',
      releasing: 'Releasing',
      released: 'Released',
      failed: 'Failed',
    },
    progress: (version) => `Publish of version ${version}`,
  },
};
