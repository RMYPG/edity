// Content paths: where a Field, a List or an Item is in a page's content, as
// its keys and Item indices, dot-separated: `hero.title`, `services.2`,
// `plans.1.price`, `plans.1.features.0`. The markup (markup.ts), the Draft
// and Publish all name them so. This is the one place that takes them apart.

/** The keys of `path`, Item indices included: `plans`, `1`, `price`. */
export function keysOf(path: string): string[] {
  return path.split('.');
}

/** The path of `keys`, the other way round from `keysOf`. */
export function pathOf(keys: readonly string[]): string {
  return keys.join('.');
}

/** The path of `key` inside the value at `path`, such as an Item's index. */
export function childPath(path: string, key: string | number): string {
  return `${path}.${key}`;
}

/** Whether `key` is an Item's index in its List. */
export function isIndex(key: string): boolean {
  return /^\d+$/.test(key);
}

/**
 * Whether `path` is `outer` or inside it: `plans.1.price` is inside `plans`,
 * and `plansx` is not.
 */
export function isWithin(path: string, outer: string): boolean {
  return path === outer || path.startsWith(`${outer}.`);
}

/**
 * Where `path` is inside `outer`, as a path from there: `1.price` for
 * `plans.1.price` inside `plans`. `undefined` when it is not inside it,
 * `outer` itself included.
 */
export function pathUnder(path: string, outer: string): string | undefined {
  return path.startsWith(`${outer}.`)
    ? path.slice(outer.length + 1)
    : undefined;
}

/**
 * `path` with `from` at its start replaced by `to`, as when an Item moves
 * from one index to another: `plans.3.price` from `plans.2` to `plans.3`
 * is `plans.3.price`. `undefined` when `path` is not within `from`.
 */
export function rebased(
  path: string,
  from: string,
  to: string,
): string | undefined {
  return isWithin(path, from) ? to + path.slice(from.length) : undefined;
}

/**
 * The index of the Item of the List at `list` that `path` is in: 1 for
 * `plans.1.price` in `plans`. `undefined` when it is in none.
 */
export function itemIndexIn(path: string, list: string): number | undefined {
  const [key] = keysOf(pathUnder(path, list) ?? '');
  return key !== undefined && isIndex(key) ? Number(key) : undefined;
}

/**
 * The path of the outermost List that `path` is inside: `plans` for
 * `plans.1.features.0` and for `plans.1.features`. `undefined` for a path
 * outside Lists, such as `hero.title` or `plans` itself.
 */
export function listPathOf(path: string): string | undefined {
  const keys = keysOf(path);
  const index = keys.findIndex(isIndex);
  return index > 0 ? pathOf(keys.slice(0, index)) : undefined;
}

/**
 * The innermost Item a Field at `path` belongs to, and the Field's key in
 * it: `plans.1` and `price` for `plans.1.price`, `services.2` and `''` for
 * `services.2`. `undefined` outside Lists.
 */
export function itemPathOf(
  path: string,
): { readonly item: string; readonly key: string } | undefined {
  const keys = keysOf(path);
  const index = keys.findLastIndex(isIndex);
  if (index < 1) return undefined;
  return {
    item: pathOf(keys.slice(0, index + 1)),
    key: pathOf(keys.slice(index + 1)),
  };
}

/**
 * `path` with every Item index as `*`, which stands for the same Field in
 * every Item: `plans.*.price`.
 */
export function pathPattern(path: string): string {
  return pathOf(keysOf(path).map((key) => (isIndex(key) ? '*' : key)));
}
