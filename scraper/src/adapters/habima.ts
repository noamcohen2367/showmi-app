/**
 * Habima (habima.co.il) — verified against the live site, Sept 2026.
 *
 * The schedule page is filled in by JavaScript, but every show page
 * (`/shows/<slug>/`) is complete server-rendered HTML:
 *
 *   .image-wrapper picture       poster (496X818) + wide banner (1920X700)
 *   .content h2 + p              one-line tagline, then the synopsis
 *   .presentations li            <time datetime="2026-09-16 20:00:00"> + order link
 *   .actors (h2 "יוצרים ו…")      ul.actors-names: "role: <strong>name</strong>"
 *                                 (first list = creative team; later lists =
 *                                 cast, or "תודות"), and/or ul.actors-list:
 *                                 cast cards with name, character and headshot
 *   .grid-gallery-inner picture  production photos
 *
 * Show URLs come from the repertoire page (25 shows at the time of writing).
 */

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import { categoriesFor } from '../lib/categories.js';
import { fromDateTimeAttr, israelNowIso, parseDayMonthTime } from '../lib/dates.js';
import { fetchText } from '../lib/http.js';
import { absoluteUrl, clean, fullSizeImage, oneLine, splitNames, stripBidi, uniqueBy } from '../lib/text.js';
import type { Adapter, ScrapedPerson, ScrapedShow, ScrapedShowtime } from '../types.js';

const ORIGIN = 'https://www.habima.co.il';

/** Pages that link to the currently running shows. */
const LISTING_PAGES = [`${ORIGIN}/${encodeURIComponent('רפרטואר')}/`, `${ORIGIN}/presentations/`];

const UPCOMING_HEADING = 'הצגות קרובות';
const PEOPLE_HEADING = /^יוצרים ו/; // "יוצרים ושחקנים" / "יוצרים ומשתתפים"
const SKIP_ROLE = /^תודות|^תודה/;

/** Creative-team roles, for "role: name" lines that sit in a cast list. */
const CREDIT_ROLE = /^(מאת|מחזה|עיבוד|נוסח|תרגום|בימוי|כוריאוגרפ|תפאורה|תלבושות|מוסיקה|מוזיקה|ניהול|מנהל|תאורה|עיצוב|הדרכ|ליווי|ע\.|עוזר|דרמטורג|וידאו|סאונד|הפקה|מפיק|צילום|פאות|איפור|קורפטי|דאנס קפטן)/;

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

  let rawSlug: string;
  try {
    rawSlug = decodeURIComponent(segments[1]);
  } catch {
    return null;
  }
  // The URL must keep any direction marks (it's what the server knows);
  // the slug used for ids must not.
  return { url: `${ORIGIN}/shows/${encodeURIComponent(rawSlug)}/`, slug: stripBidi(rawSlug) };
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

function textWithBreaks($: cheerio.CheerioAPI, el: Element): string {
  const copy = $(el).clone();
  copy.find('br').replaceWith('\n');
  return clean(copy.text());
}

/** Best URL inside a <picture>: the first <source> (largest), else the <img>, full size. */
function pictureUrl($: cheerio.CheerioAPI, picture: cheerio.Cheerio<Element>, prefer?: RegExp): string | null {
  const sources = picture
    .find('source[srcset]')
    .map((_, s) => ($(s).attr('srcset') ?? '').split(/\s+/)[0] ?? '')
    .get()
    .filter(Boolean);
  const chosen = (prefer && sources.find((s) => prefer.test(s))) ?? sources[0] ?? picture.find('img').attr('src');
  return chosen ? absoluteUrl(fullSizeImage(chosen), ORIGIN) : null;
}

function parseNameLine($: cheerio.CheerioAPI, li: Element): ScrapedPerson[] {
  const text = oneLine($(li).text());
  const colon = text.indexOf(':');
  if (colon === -1) return [];
  const role = oneLine(text.slice(0, colon));
  const strong = oneLine($(li).find('strong, b').text());
  return splitNames(strong || text.slice(colon + 1)).map((name) => ({ name, role }));
}

function parsePeople($: cheerio.CheerioAPI) {
  const heading = $('h2').filter((_, h) => PEOPLE_HEADING.test(oneLine($(h).text()))).first();
  const section = heading.parent();
  const credits: ScrapedPerson[] = [];
  const performers: ScrapedPerson[] = [];
  if (!heading.length) return { credits, performers };

  section.find('ul.actors-names').each((listIndex, ul) => {
    for (const person of $(ul).children('li').toArray().flatMap((li) => parseNameLine($, li))) {
      if (SKIP_ROLE.test(person.role)) continue;
      // The first list is always the creative team; later lists are cast,
      // except for creative roles that occasionally trail into them.
      (listIndex === 0 || CREDIT_ROLE.test(person.role) ? credits : performers).push(person);
    }
  });

  section.find('ul.actors-list > li').each((_, li) => {
    const card = $(li);
    const name = oneLine(card.find('.actor-name').text());
    if (!name) return;
    performers.push({
      name,
      role: oneLine(card.find('.actor-role').text()),
      photoUrl: pictureUrl($, card.find('picture').first()) ?? undefined,
      profileUrl: absoluteUrl(card.find('a.actor-link').attr('href') ?? '', ORIGIN) ?? undefined,
    });
  });

  const key = (p: ScrapedPerson) => `${p.name}|${p.role}`;
  return { credits: uniqueBy(credits, key), performers: uniqueBy(performers, key) };
}

export function parseShowPage(html: string, sourceUrl: string, now: Date = new Date()): ScrapedShow {
  const $ = cheerio.load(html);
  const show = normalizeShowUrl(sourceUrl);
  if (!show) throw new Error(`Not a Habima show URL: ${sourceUrl}`);

  // --- name -----------------------------------------------------------------
  const rawTitle = $('meta[property="og:title"]').attr('content') ?? $('title').text();
  const name = stripBidi(oneLine(rawTitle.replace(/\s*[-–|]\s*הבימה\s*$/, '')));
  if (!name) throw new Error(`No title found on ${sourceUrl}`);

  // --- showtimes: one per ticketing link, dated by its row's <time datetime> ---
  const nowIso = israelNowIso(now);
  const showtimes: ScrapedShowtime[] = [];
  $('a[href*="tickets.habima.co.il/order/"]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    const orderId = href.match(/\/order\/(\d+)/)?.[1];
    if (!orderId) return;
    const row = $(a).closest('li').length ? $(a).closest('li') : $(a).parent();
    const startsAt = fromDateTimeAttr(row.find('time[datetime]').attr('datetime')) ?? parseDayMonthTime(row.text(), now);
    if (!startsAt || startsAt < nowIso) return;
    showtimes.push({ id: `habima-${orderId}`, startsAt, purchaseUrl: `https://tickets.habima.co.il/order/${orderId}` });
  });

  // --- tagline + synopsis: the <h2> before "הצגות קרובות", and the <p>s between ---
  const flow = $('h2, p').toArray();
  const upcomingIndex = flow.findIndex((el) => el.tagName === 'h2' && oneLine($(el).text()) === UPCOMING_HEADING);
  let genreLabel: string | undefined;
  const synopsisParts: string[] = [];
  if (upcomingIndex > 0) {
    let taglineIndex = -1;
    for (let i = upcomingIndex - 1; i >= 0; i--) {
      if (flow[i]!.tagName === 'h2') {
        taglineIndex = i;
        break;
      }
    }
    if (taglineIndex !== -1) genreLabel = stripBidi(oneLine($(flow[taglineIndex]!).text())) || undefined;
    for (let i = taglineIndex + 1; i < upcomingIndex; i++) {
      const text = textWithBreaks($, flow[i]!);
      if (text) synopsisParts.push(text);
    }
  }
  const synopsis = synopsisParts.join('\n\n') || clean($('meta[property="og:description"]').attr('content'));

  // --- images: poster, then gallery (never the wide banner or actor headshots) ---
  const images: string[] = [];
  const poster = pictureUrl($, $('.image-wrapper picture').first(), /496x818/i);
  if (poster && !/1920x700/i.test(poster)) images.push(poster);
  $('.grid-gallery-inner picture').each((_, picture) => {
    const url = pictureUrl($, $(picture));
    if (url) images.push(url);
  });
  if (images.length === 0) {
    const og = $('meta[property="og:image"]').attr('content');
    if (og) images.push(absoluteUrl(fullSizeImage(og), ORIGIN)!);
  }

  const { credits, performers } = parsePeople($);

  return {
    id: `habima-${show.slug}`,
    theaterId: 'habima',
    sourceUrl: show.url,
    name,
    synopsis,
    images: [...new Set(images)],
    genreLabel,
    // Habima's label is genuinely a genre line ("דרמה ישראלית"), so it and
    // the title are taken at face value; the synopsis goes in as prose.
    categories: categoriesFor({ label: [genreLabel, name].filter(Boolean).join(' '), prose: synopsis }),
    performers,
    credits,
    showtimes: uniqueBy(showtimes, (s) => s.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  };
}

// ---------------------------------------------------------------------------
// Network orchestration.
// ---------------------------------------------------------------------------

export const habimaAdapter: Adapter = {
  theaterId: 'habima',

  async scrape() {
    const urls = new Set<string>();
    for (const page of LISTING_PAGES) {
      try {
        extractShowUrls(await fetchText(page)).forEach((url) => urls.add(url));
      } catch (error) {
        console.warn(`[habima] listing page failed: ${decodeURI(page)}:`, error instanceof Error ? error.message : error);
      }
    }
    if (urls.size === 0) throw new Error('[habima] found no show URLs on the listing pages');
    console.log(`[habima] ${urls.size} show pages to read`);

    const shows: ScrapedShow[] = [];
    let failures = 0;
    for (const url of urls) {
      try {
        shows.push(parseShowPage(await fetchText(url), url));
      } catch (error) {
        failures++;
        console.warn(`[habima] failed to read ${decodeURI(url)}:`, error instanceof Error ? error.message : error);
      }
    }
    if (failures > urls.size * 0.3) {
      throw new Error(`[habima] ${failures}/${urls.size} show pages failed — the site layout probably changed`);
    }
    return shows;
  },
};
