import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { averageColor, objectKeyFor } from '../src/lib/images.js';

const solid = (r: number, g: number, b: number, width = 8, height = 8) =>
  sharp({ create: { width, height, channels: 3, background: { r, g, b } } })
    .png()
    .toBuffer();

describe('objectKeyFor', () => {
  it('is stable for the same source URL', () => {
    const url =
      'https://www.lessin.co.il/wp-content/uploads/2026/08/poster.jpg';
    expect(objectKeyFor('lessin', url, 'image/jpeg')).toBe(
      objectKeyFor('lessin', url, 'image/jpeg'),
    );
  });

  it('differs per source URL', () => {
    expect(objectKeyFor('lessin', 'https://x/a.jpg', 'image/jpeg')).not.toBe(
      objectKeyFor('lessin', 'https://x/b.jpg', 'image/jpeg'),
    );
  });

  it('files under the theater and uses the content type for the extension', () => {
    expect(objectKeyFor('habima', 'https://x/a', 'image/jpeg')).toMatch(
      /^habima\/[0-9a-f]{32}\.jpg$/,
    );
    expect(objectKeyFor('cameri', 'https://x/a', 'image/webp')).toMatch(
      /^cameri\/[0-9a-f]{32}\.webp$/,
    );
  });

  it('survives the percent-encoded Hebrew filenames these sites actually serve', () => {
    const real =
      'https://www.habima.co.il/wp-content/uploads/2026/06/496X818-%D7%A1%D7%95%D7%97%D7%A8%D7%99.jpg';
    expect(objectKeyFor('habima', real, 'image/jpeg')).toMatch(
      /^habima\/[0-9a-f]{32}\.jpg$/,
    );
  });

  it('falls back to .bin for a content type it does not know', () => {
    expect(
      objectKeyFor('habima', 'https://x/a', 'application/octet-stream'),
    ).toMatch(/\.bin$/);
  });
});

describe('averageColor', () => {
  it('returns the exact colour of a solid image', async () => {
    expect(await averageColor(await solid(0xc2, 0x41, 0x0c))).toBe('#c2410c');
  });

  it('pads single-digit channels', async () => {
    expect(await averageColor(await solid(0x01, 0x02, 0x03))).toBe('#010203');
  });

  it('averages a mixed image rather than sampling one pixel', async () => {
    const half = await sharp({
      create: {
        width: 2,
        height: 1,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite([{ input: await solid(255, 255, 255, 1, 1), left: 1, top: 0 }])
      .png()
      .toBuffer();
    expect(await averageColor(half)).toBe('#808080');
  });

  it('gives up quietly on something that is not a decodable image', async () => {
    // An SVG placeholder and a truncated download both land here; neither
    // should cost the show its poster.
    expect(
      await averageColor(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      ),
    ).toBeUndefined();
    expect(await averageColor(Buffer.from([0x00, 0x01, 0x02]))).toBeUndefined();
  });
});
