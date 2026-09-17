/** Small text/URL helpers shared by every adapter. */

import * as cheerio from 'cheerio';

/** Collapse runs of spaces but keep line breaks, trim each line. */
export function clean(text: string | undefined | null): string {
  return (text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Single line: every whitespace run becomes one space. */
export function oneLine(text: string | undefined | null): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Invisible direction marks (U+2066–2069 isolates, LRM/RLM, embeddings).
 * Habima wraps some titles in them, e.g. "⁨הגבעטרון…⁩"; they'd end up in
 * ids and break equality with the same title typed normally.
 */
const BIDI = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
export function stripBidi(text: string): string {
  return text.replace(BIDI, '');
}

/** "ד&quot;ר סטריינג'לאב" → 'ד"ר סטריינג'לאב'. */
export function decodeEntities(text: string): string {
  if (!/&[#a-z0-9]+;/i.test(text)) return text;
  return cheerio.load(`<p>${text.replace(/</g, '&lt;')}</p>`)('p').text();
}

/** "a, b / c" → ['a', 'b', 'c']. Alternating cast is written with "/". */
export function splitNames(text: string): string[] {
  return text.split(/\s*[,/|]\s*/).map(oneLine).filter(Boolean);
}

/**
 * WordPress serves resized copies as "name-530x344.jpg"; the same path
 * without the suffix is the original upload.
 */
export function fullSizeImage(src: string): string {
  return src.replace(/-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp)$)/i, '');
}

/** Absolute, percent-encoded (safe for expo-image), no query string or fragment. */
export function absoluteUrl(href: string, base: string): string | null {
  try {
    const url = new URL(href.trim(), base);
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

/** Last non-empty path segment, decoded. */
export function slugFromUrl(url: string): string {
  const segment = new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** For matching a title across two pages of the same site: no punctuation, dashes or spaces. */
export function matchKey(text: string): string {
  return stripBidi(decodeEntities(text)).replace(/[\s\-–—_"'׳״”“,.!?:()]/g, '').toLowerCase();
}

export function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
