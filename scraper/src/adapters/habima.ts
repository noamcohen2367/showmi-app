/**
 * Habima (habima.co.il).
 *
 * The schedule page itself is filled in by JavaScript, but every show page
 * (`/shows/<slug>/`) is complete server-rendered HTML: poster, genre line,
 * synopsis, an "הצגות קרובות" list of "15.09 20:00 יום שלישי" + a Pres
 * Global order link per performance, and a "יוצרים ושחקנים" section.
 *
 * So: collect show URLs from the listing pages, then parse each show page.
 *
 * Parsing leans on things unlikely to change — ticketing links, the section
 * headings' *text*, document order — rather than CSS class names.
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import { categoriesFor } from '../lib/categories.js';
import { israelNowIso, parseDayMonthTime } from '../lib/dates.js';
import { fetchText, HttpError } from '../lib/http.js';
import type { Adapter, ScrapedPerson, ScrapedShow, ScrapedShowtime } from '../types.js';

const ORIGIN = 'https://www.habima.co.il';

/** Pages that link to the currently running shows. */
const LISTING_PAGES = [
  `${ORIGIN}/presentations/`,
  `${ORIGIN}/${encodeURIComponent('רפרטואר')}/`,
];

/** Only used if the listing pages yield nothing (e.g. they became JS-only too). Unverified guesses. */
const SITEMAP_FALLBACKS = [`${ORIGIN}/shows-sitemap.xml`, `${ORIGIN}/wp-sitemap-posts-shows-1.xml`];

const UPCOMING_HEADING = 'הצגות קרובות';
const PEOPLE_HEADING = 'יוצרים ושחקנים';

/** Roles that are creative team, not cast — used only when the page doesn't split them into two lists. */
const CREDIT_ROLE = /^(מאת|מחזה|עיבוד|תרגום|בימוי|כוריאוגרפ|תפאורה|תלבושות|מוסיקה|מוזיקה|ניהול מוסיקלי|ניהול מוזיקלי|מנהל מוסיקלי|מנהל מוזיקלי|תאורה|עיצוב|הדרכ|ליווי|ע\.|עוזר|עוזרת|דרמטורג|וידאו|סאונד|הפקה|מפיק)/;

// ---------------------------------------------------------------------------
// Pure parsing (no network) — this is what the tests exercise.
// ---------------------------------------------------------------------------

/** Canonical form of a show URL, or null if `href` isn't one. */
export function normalizeShowUrl(href: string, base = ORIGIN): { url: string; slug: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(href, base);
  } catch {
    return null;
  }
  if (!/^(www\.)?habima\.co\.il$/.test(parsed.hostname)) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 2 || segments[0] !== 'shows' || !segments[1]) return null;

  let slug: string;
  try {
    slug = decodeURIComponent(segments[1]);
  } catch {
    return null;
  }
  return { url: `${ORIGIN}/shows/${encodeURIComponent(slug)}/`, slug };
}

export function extractShowUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $('a[href]').each((_, a) => {
    const show = normalizeShowUrl($(a).attr('href') ?? '');
    if (show) urls.add(show.url);
  });
  return [...urls];
}

export function extractSitemapUrls(xml: string): string[] {
  const $ = cheerio.load(xml, { xml: true });
  const urls = new Set<string>();
  $('loc').each((_, loc) => {
    const show = normalizeShowUrl($(loc).text().trim());
    if (show) urls.add(show.url);
  });
  return [...urls];
}

const clean = (text: string) => text.replace(/[ \t\u00a0]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();

function textWithBreaks($: cheerio.CheerioAPI, el: Element): string {
  const copy = $(el).clone();
  copy.find('br').replaceWith('\n');
  return clean(copy.text());
}

/** "…-182x300.jpg" is a WordPress thumbnail; the same path without the suffix is the original. */
export function fullSizeImage(src: string): string {
  return src.replace(/-\d+x\d+(?=\.(jpe?g|png|webp)$)/i, '');
}

function splitNames(text: string): string[] {
  return text.split(/\s*[,/]\s*/).map((name) => clean(name)).filter(Boolean);
}

function parsePerson($: cheerio.CheerioAPI, li: Element): ScrapedPerson[] {
  const text = clean($(li).text());
  const colon = text.indexOf(':');
  if (colon === -1) return [];
  const role = clean(text.slice(0, colon));
  const strong = clean($(li).find('strong, b').text());
  const names = splitNames(strong || text.slice(colon + 1));
  return names.map((name) => ({ name, role }));
}

export function parseShowPage(html: string, sourceUrl: string, now: Date = new Date()): ScrapedShow {
  const $ = cheerio.load(html);
  const show = normalizeShowUrl(sourceUrl);
  if (!show) throw new Error(`Not a Habima show URL: ${sourceUrl}`);

  // --- name -----------------------------------------------------------------
  const rawTitle = $('meta[property="og:title"]').attr('content') ?? $('title').text();
  const name = clean(rawTitle.replace(/\s*[-–|]\s*הבימה\s*$/, ''));
  if (!name) throw new Error(`No title found on ${sourceUrl}`);

  // --- showtimes (anchored on the ticketing links, not on layout) -----------
  const nowIso = israelNowIso(now);
  const showtimesById = new Map<string, ScrapedShowtime>();
  $('a[href*="tickets.habima.co.il/order/"]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const orderId = href.match(/\/order\/(\d+)/)?.[1];
    if (!orderId) return;
    const row = $(a).closest('li').length ? $(a).closest('li') : $(a).parent();
    const startsAt = parseDayMonthTime(row.text(), now);
    if (!startsAt || startsAt < nowIso) return;
    showtimesById.set(orderId, { id: `habima-${orderId}`, startsAt, purchaseUrl: href });
  });
  const showtimes = [...showtimesById.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  // --- genre line + synopsis: everything between the genre <h2> and "הצגות קרובות" ---
  const flow = $('h2, p').toArray();
  const upcomingIndex = flow.findIndex((el) => el.tagName === 'h2' && clean($(el).text()) === UPCOMING_HEADING);
  let genreLabel: string | undefined;
  const synopsisParts: string[] = [];
  if (upcomingIndex !== -1) {
    let genreIndex = -1;
    for (let i = upcomingIndex - 1; i >= 0; i--) {
      if (flow[i]!.tagName === 'h2') {
        genreIndex = i;
        break;
      }
    }
    if (genreIndex !== -1) genreLabel = clean($(flow[genreIndex]!).text()) || undefined;
    for (let i = genreIndex + 1; i < upcomingIndex; i++) {
      const text = textWithBreaks($, flow[i]!);
      if (text) synopsisParts.push(text);
    }
  }
  const synopsis =
    synopsisParts.join('\n\n') ||
    clean($('meta[property="og:description"]').attr('content') ?? $('meta[name="description"]').attr('content') ?? '');

  // --- people: <li>s after "יוצרים ושחקנים", grouped by their <ul> ---------
  const peopleFlow = $('h2, li').toArray();
  const peopleIndex = peopleFlow.findIndex((el) => el.tagName === 'h2' && clean($(el).text()) === PEOPLE_HEADING);
  const groups: Element[][] = [];
  if (peopleIndex !== -1) {
    let lastParent: unknown = null;
    for (const el of peopleFlow.slice(peopleIndex + 1)) {
      if (el.tagName === 'h2') break;
      if (el.parent !== lastParent) groups.push([]);
      lastParent = el.parent;
      groups.at(-1)!.push(el);
    }
  }
  let credits: ScrapedPerson[] = [];
  let performers: ScrapedPerson[] = [];
  if (groups.length >= 2) {
    // Habima prints creative team first, cast last.
    credits = groups.slice(0, -1).flat().flatMap((li) => parsePerson($, li));
    performers = groups.at(-1)!.flatMap((li) => parsePerson($, li));
  } else if (groups.length === 1) {
    for (const person of groups[0]!.flatMap((li) => parsePerson($, li))) {
      (CREDIT_ROLE.test(person.role) ? credits : performers).push(person);
    }
  }

  // --- images -----------------------------------------------------------------
  const images = new Set<string>();
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) images.add(fullSizeImage(new URL(ogImage, ORIGIN).href));
  // The poster is the first uploaded image on the page; later ones are promo pop-ups.
  const poster = $('img[src*="/wp-content/uploads/"]').first().attr('src');
  if (poster) images.add(fullSizeImage(new URL(poster, ORIGIN).href));

  return {
    id: `habima-${show.slug}`,
    theaterId: 'habima',
    sourceUrl: show.url,
    name,
    synopsis,
    images: [...images],
    genreLabel,
    categories: categoriesFor(genreLabel, name),
    performers,
    credits,
    showtimes,
  };
}

// ---------------------------------------------------------------------------
// Network orchestration.
// ---------------------------------------------------------------------------

async function discoverShowUrls(): Promise<{ urls: string[]; fromSitemap: boolean }> {
  const urls = new Set<string>();
  for (const page of LISTING_PAGES) {
    try {
      extractShowUrls(await fetchText(page)).forEach((url) => urls.add(url));
    } catch (error) {
      console.warn(`[habima] listing page failed: ${page}`, error instanceof Error ? error.message : error);
    }
  }
  if (urls.size > 0) return { urls: [...urls], fromSitemap: false };

  for (const sitemap of SITEMAP_FALLBACKS) {
    try {
      const found = extractSitemapUrls(await fetchText(sitemap));
      if (found.length) return { urls: found, fromSitemap: true };
    } catch (error) {
      if (!(error instanceof HttpError && error.status === 404)) console.warn(`[habima] sitemap failed: ${sitemap}`, error instanceof Error ? error.message : error);
    }
  }
  return { urls: [], fromSitemap: false };
}

export const habimaAdapter: Adapter = {
  theaterId: 'habima',

  async scrape() {
    const { urls, fromSitemap } = await discoverShowUrls();
    if (urls.length === 0) throw new Error('[habima] found no show URLs on the listing pages or sitemaps');
    console.log(`[habima] ${urls.length} show pages to read${fromSitemap ? ' (from sitemap)' : ''}`);

    const shows: ScrapedShow[] = [];
    let failures = 0;
    for (const url of urls) {
      try {
        const show = parseShowPage(await fetchText(url), url);
        // A sitemap also lists long-finished productions; only keep ones with dates.
        if (fromSitemap && show.showtimes.length === 0) continue;
        shows.push(show);
      } catch (error) {
        failures++;
        console.warn(`[habima] failed to read ${decodeURI(url)}:`, error instanceof Error ? error.message : error);
      }
    }
    if (failures > urls.length * 0.3) {
      throw new Error(`[habima] ${failures}/${urls.length} show pages failed — the site layout probably changed`);
    }
    return shows;
  },
};
