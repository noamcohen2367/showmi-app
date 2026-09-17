import { describe, expect, it } from 'vitest';

import { sanityProblems } from '../src/lib/sanity.js';
import type { ScrapedShow } from '../src/types.js';

const show = (i: number, showtimes = 1): ScrapedShow => ({
  id: `habima-${i}`, theaterId: 'habima', sourceUrl: `https://x/${i}`, name: `show ${i}`, synopsis: '',
  images: ['https://x/a.jpg'], categories: [], performers: [], credits: [],
  showtimes: Array.from({ length: showtimes }, (_, j) => ({ id: `habima-${i}${j}`, startsAt: '2026-10-01T20:00:00', purchaseUrl: 'https://x' })),
});

describe('sanityProblems', () => {
  it('passes a normal run', () => {
    expect(sanityProblems([show(1), show(2), show(3)], 3)).toEqual([]);
  });
  it('blocks an empty result', () => {
    expect(sanityProblems([], 10)).toContain('no shows found');
  });
  it('blocks a result with no dates at all', () => {
    expect(sanityProblems([show(1, 0), show(2, 0)], 0)).toContain('no upcoming showtimes found across all shows');
  });
  it('blocks losing more than half the catalogue', () => {
    expect(sanityProblems([show(1), show(2)], 10)).toContain('only 2 shows, down from 10 active');
  });
});
