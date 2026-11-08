// The Editor's text about a Publish and its progress, in every language it
// speaks (N6). i18n.ts gives it to the Editor as `t.publishing`.
import type { PublishProblem } from './api.js';
import type { Locale } from './i18n.js';
import type { ShownStage } from './publishing.js';

/** What the Client has to be told after a Publish (P5, A3). */
export type PublishNotice =
  | PublishProblem
  /**
   * Conflicts (V2), which stay in the Draft. `published` when the other
   * Changes made it through.
   */
  | {
      readonly kind: 'conflicts';
      readonly count: number;
      readonly published: boolean;
    }
  /**
   * What the Field definitions refused. `marked` when the page shows all of
   * it, marked, so the Client can correct it.
   */
  | {
      readonly kind: 'violations';
      readonly count: number;
      readonly marked: boolean;
    }
  /** The Client is back from logging in, as their session had expired. */
  | { readonly kind: 'signed-back-in' }
  /** The Publish the bar followed is not one on the Site, or no longer. */
  | { readonly kind: 'lost' };

/** Every text about a Publish that the Editor shows or gives screen readers. */
export interface PublishMessages {
  /** The Publish button's text while the Draft is on its way. */
  readonly sending: string;
  /** Each stage a Publish goes through (P4). */
  readonly stages: Readonly<Record<ShownStage, string>>;
  /** The name of the progress of the Publish of `version`. */
  progress(version: string): string;
  /** That the progress can't be read for now, and the changes are saved. */
  readonly progressUnknown: string;
  /**
   * What the Client has to be told after a Publish: what happened, and that
   * the Draft is safe.
   */
  notice(notice: PublishNotice): string;
}

/** How many minutes there are in `seconds`, rounded up. */
const minutes = (seconds: number) => Math.ceil(seconds / 60);

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
    progressUnknown:
      'No se puede comprobar ahora cómo va la publicación. Tus cambios están guardados.',
    notice(notice) {
      const safe = 'Tu borrador está a salvo.';
      switch (notice.kind) {
        case 'conflicts': {
          const one = notice.count === 1;
          return `${notice.published ? 'Se ha publicado el resto. ' : ''}${
            one
              ? '1 cambio no se ha publicado porque ese contenido cambió en la web mientras lo editabas. Sigue en tu borrador, marcado en la página; descártalo si prefieres la versión de la web.'
              : `${notice.count} cambios no se han publicado porque ese contenido cambió en la web mientras los editabas. Siguen en tu borrador, marcados en la página; descártalos si prefieres la versión de la web.`
          }`;
        }
        case 'violations':
          if (!notice.marked) {
            return `No se ha publicado: hay contenido que no cumple los límites de la web y no se puede corregir desde aquí. Avisa a quien mantiene tu web. ${safe}`;
          }
          return notice.count === 1
            ? `No se ha publicado: 1 valor no cumple los límites de la web. Está marcado en rojo: corrígelo y vuelve a publicar. ${safe}`
            : `No se ha publicado: ${notice.count} valores no cumplen los límites de la web. Están marcados en rojo: corrígelos y vuelve a publicar. ${safe}`;
        case 'signed-back-in':
          return 'Tu sesión había caducado y has vuelto a entrar. Tu borrador está a salvo: pulsa Publicar para enviarlo.';
        case 'lost':
          return `No se puede seguir esta publicación porque la web ya no la reconoce, así que esos cambios pueden no llegar a verse. Recarga la página para ver lo que hay publicado y avisa a quien mantiene tu web. ${safe}`;
        case 'rate-limited': {
          const wait =
            notice.retryAfter === undefined
              ? 'un rato'
              : minutes(notice.retryAfter) === 1
                ? '1 minuto'
                : `${minutes(notice.retryAfter)} minutos`;
          return `Se ha publicado demasiadas veces seguidas. Vuelve a intentarlo dentro de ${wait}. ${safe}`;
        }
        case 'too-large':
          return 'Tu borrador es demasiado grande para publicarlo de una vez. Sigue a salvo en este navegador: avisa a quien mantiene tu web.';
        case 'site-broken':
          return `No se ha podido publicar por un problema en la configuración de tu web, que tiene que arreglar quien la mantiene. ${safe}`;
        case 'unavailable':
          return `No se ha podido publicar en este momento. Vuelve a intentarlo dentro de un rato. ${safe}`;
        case 'refused':
          return `El servidor no ha aceptado esta publicación. Recarga la página y vuelve a intentarlo; si sigue igual, avisa a quien mantiene tu web. ${safe}`;
        case 'offline':
          return `No se ha podido conectar con el servidor. Comprueba tu conexión y vuelve a publicar. ${safe}`;
      }
    },
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
    progressUnknown:
      "This Publish's progress can't be checked right now. Your changes are saved.",
    notice(notice) {
      const safe = 'Your draft is safe.';
      switch (notice.kind) {
        case 'conflicts': {
          const one = notice.count === 1;
          return `${notice.published ? 'The rest was published. ' : ''}${
            one
              ? "1 change was not published because that content changed on the site while you were editing it. It stays in your draft, marked on the page; discard it to keep the site's version."
              : `${notice.count} changes were not published because that content changed on the site while you were editing them. They stay in your draft, marked on the page; discard them to keep the site's version.`
          }`;
        }
        case 'violations':
          if (!notice.marked) {
            return `Nothing was published: some content breaks the site's limits and can't be fixed from here. Tell your developer. ${safe}`;
          }
          return notice.count === 1
            ? `Nothing was published: 1 value breaks the site's limits. It is marked in red: fix it and publish again. ${safe}`
            : `Nothing was published: ${notice.count} values break the site's limits. They are marked in red: fix them and publish again. ${safe}`;
        case 'signed-back-in':
          return 'Your session had expired and you have logged in again. Your draft is safe: press Publish to send it.';
        case 'lost':
          return `This Publish can't be followed because the site no longer knows it, so those changes may not go live. Reload the page to see what is published, and tell your developer. ${safe}`;
        case 'rate-limited': {
          const wait =
            notice.retryAfter === undefined
              ? 'a while'
              : minutes(notice.retryAfter) === 1
                ? '1 minute'
                : `${minutes(notice.retryAfter)} minutes`;
          return `This site has been published too often lately. Try again in ${wait}. ${safe}`;
        }
        case 'too-large':
          return 'Your draft is too big to publish in one go. It is safe in this browser: tell your developer.';
        case 'site-broken':
          return `Nothing was published because of a problem with your site's setup, which your developer has to fix. ${safe}`;
        case 'unavailable':
          return `Publishing isn't possible right now. Try again in a while. ${safe}`;
        case 'refused':
          return `The server did not accept this Publish. Reload the page and try again; if it keeps happening, tell your developer. ${safe}`;
        case 'offline':
          return `The server could not be reached. Check your connection and publish again. ${safe}`;
      }
    },
  },
};
