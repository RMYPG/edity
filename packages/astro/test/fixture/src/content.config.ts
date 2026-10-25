import { defineFields, list, number, text } from '@edity/core';
import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';

/** The Field definitions of the home page. */
export const homeFields = defineFields({
  brand: {
    name: text({ maxChars: 30, maxLines: 1 }),
  },
  hero: {
    title: text({ maxChars: 60, maxLines: 2, maxLinesNarrow: 3 }),
    lead: text({ maxChars: 200, maxLines: 3, maxLinesNarrow: 6 }),
    cta: text({ maxChars: 24, maxLines: 1 }),
  },
  stats: {
    patients: number({ min: 0, max: 1_000_000, decimals: 0 }),
  },
  visit: {
    label: text({ maxChars: 40, maxLines: 1 }),
    price: number({ min: 0, max: 500, decimals: 2 }),
  },
  services: list(text({ maxChars: 40, maxLines: 1 }), { min: 1, max: 8 }),
  plans: list(
    {
      name: text({ maxChars: 24, maxLines: 1 }),
      price: number({ min: 0, max: 999, decimals: 2 }),
      features: list(text({ maxChars: 60, maxLines: 2 }), { min: 1, max: 5 }),
    },
    { min: 1, max: 3 },
  ),
  contact: {
    title: text({ maxChars: 50, maxLines: 2 }),
    call: text({ maxChars: 24, maxLines: 1 }),
  },
});

export const collections = {
  home: defineCollection({
    loader: glob({ pattern: 'home.json', base: './src/content' }),
    schema: homeFields,
  }),
};
