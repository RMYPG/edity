import { describe, expect, test } from 'vitest';
import {
  childPath,
  isIndex,
  isWithin,
  itemIndexIn,
  itemPathOf,
  keysOf,
  listPathOf,
  pathOf,
  pathPattern,
  pathUnder,
  rebased,
} from './paths.js';

test('a path is its keys, Item indices included', () => {
  expect(keysOf('plans.1.price')).toEqual(['plans', '1', 'price']);
  expect(pathOf(['plans', '1', 'price'])).toBe('plans.1.price');
  expect(childPath('plans', 1)).toBe('plans.1');
  expect(childPath('plans.1', 'price')).toBe('plans.1.price');
});

test('an Item index is digits only', () => {
  expect(isIndex('0')).toBe(true);
  expect(isIndex('12')).toBe(true);
  expect(isIndex('-1')).toBe(false);
  expect(isIndex('first')).toBe(false);
  expect(isIndex('')).toBe(false);
});

describe('inside a path', () => {
  test('is the path itself, or one that goes on from it', () => {
    expect(isWithin('plans', 'plans')).toBe(true);
    expect(isWithin('plans.1.price', 'plans')).toBe(true);
    expect(isWithin('plansx', 'plans')).toBe(false);
    expect(isWithin('plan', 'plans')).toBe(false);
  });

  test('is where from there, strictly inside', () => {
    expect(pathUnder('plans.1.price', 'plans')).toBe('1.price');
    expect(pathUnder('plans', 'plans')).toBeUndefined();
    expect(pathUnder('plansx.1', 'plans')).toBeUndefined();
  });

  test('moves with its start', () => {
    expect(rebased('plans.2', 'plans.2', 'plans.3')).toBe('plans.3');
    expect(rebased('plans.2.features.0', 'plans.2', 'plans.0')).toBe(
      'plans.0.features.0',
    );
    expect(rebased('plans.20', 'plans.2', 'plans.3')).toBeUndefined();
    expect(rebased('hero.title', 'plans.2', 'plans.3')).toBeUndefined();
  });

  test('is in an Item of a List, at its index', () => {
    expect(itemIndexIn('plans.1.price', 'plans')).toBe(1);
    expect(itemIndexIn('services.3', 'services')).toBe(3);
    expect(itemIndexIn('plans', 'plans')).toBeUndefined();
    expect(itemIndexIn('hero.title', 'plans')).toBeUndefined();
  });
});

describe('listPathOf', () => {
  test('is the outermost List a path is in', () => {
    expect(listPathOf('plans.1.features.0')).toBe('plans');
    expect(listPathOf('plans.1.features')).toBe('plans');
    expect(listPathOf('plans.0.price')).toBe('plans');
    expect(listPathOf('services.3')).toBe('services');
    expect(listPathOf('footer.links.0')).toBe('footer.links');
  });

  test('is undefined outside Lists, and for a List outside Lists', () => {
    expect(listPathOf('hero.title')).toBeUndefined();
    expect(listPathOf('services')).toBeUndefined();
  });
});

describe('itemPathOf', () => {
  test('is the Item a Field belongs to, and its key there', () => {
    expect(itemPathOf('plans.1.price')).toEqual({
      item: 'plans.1',
      key: 'price',
    });
    expect(itemPathOf('plans.1.features.0')).toEqual({
      item: 'plans.1.features.0',
      key: '',
    });
    expect(itemPathOf('services.2')).toEqual({ item: 'services.2', key: '' });
  });

  test('is undefined outside Lists', () => {
    expect(itemPathOf('hero.title')).toBeUndefined();
    expect(itemPathOf('services')).toBeUndefined();
  });
});

describe('pathPattern', () => {
  test('stands for the same Field in every Item', () => {
    expect(pathPattern('plans.1.features.0')).toBe('plans.*.features.*');
    expect(pathPattern('services.12')).toBe('services.*');
    expect(pathPattern('hero.title')).toBe('hero.title');
  });
});
