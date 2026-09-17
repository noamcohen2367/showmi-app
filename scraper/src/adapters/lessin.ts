/**
 * Beit Lessin (lessin.co.il) — verified against the live site, Sept 2026.
 *
 * Two server-rendered sources, joined by Pres Global order id:
 *
 * 1. The home page schedule: every performance for ~3 months as
 *      <li show-date="17-09-2026"><a href="…presglobal.store/order/45017">
 *        מסיבת אירוסין <span>אולם 2 11:00</span></a></li>
 *    — full date *with year*, but only a title to identify the show.
 *
 * 2. Each show page (`/shows/<slug>/`, listed on `/הצגות/`): name, tagline,
 *    synopsis, cast and credits, photos, and its own performance rows
 *      .mainshow_list .mulrow → .mu1 "18.09" · .mu2 "21:30" · .mu3.mc1 "אולם 2"
 *    — tied to the show for certain, but without a year.
 *
 * Show-page rows decide which show a performance belongs to; the home page
 * supplies the year (and any performance a show page doesn't list, matched
 * by title).
 */

import * as cheerio from 'cheerio';

import { categoriesFor } from '../lib/categories.js';
import { fromDayMonthYear, israelNowIso, parseDayMonthTime } from '../lib/dates.js';
import { fetchText } from '../lib/http.js';
import {
  absoluteUrl,
  clean,
  fullSizeImage,
  matchKey,
  oneLine,
  slugFromUrl,
  splitNames,
  uniqueBy,
} from '../lib/text.js';
import type { Adapter, ScrapedPerson, ScrapedShow, ScrapedShowtime } from '../types.js';

const ORIGIN = 'https://www.lessin.co.il';
const HOME_URL = `${ORIGIN}/`;
const LISTING_URL = `${ORIGIN}/${encodeURIComponent('הצגות')}/`;

const orderUrl = (id: string) => `https://lessin.presglobal.store/order/${id}`;
const ORDER_ID = /(?:\/order\/|\/eWeb\/event\/)(\d+)/;

/** Roles in "יוצרים ושחקנים" that are the cast rather than the creative team. */
const PERFORMER_ROLE = /^(משתתפים|בהשתתפות|שחקנים|מחליפים)/;
/** Synopsis lines that are house notes or photo credits, not description. */
const NOT_SYNOPSIS = /^(\*|צילום|מוצג בהסדר|לקבוצות מאורגנות)/;

// ---------------------------------------------------------------------------
// Pure parsing
// ---------------------------------------------------------------------------

export type HomeEntry = { orderId: string; startsAt: string; title: string; hall?: string };

export function parseLessinHome(html: string): HomeEntry[] {
  const $ = cheerio.load(html);
  const entries: HomeEntry[] = [];
  $('li[show-date]').each((_, li) => {
    const a = $(li).find('a[href]').first();
    const orderId = (a.attr('href') ?? '').match(ORDER_ID)?.[1];
    if (!orderId) return;
    const hallAndTime = oneLine(a.find('span').text()); // "אולם 2 11:00"
    const m = hallAndTime.match(/^(.*?)\s*(\d{1,2}:\d{2})$/);
    const startsAt = m ? fromDayMonthYear($(li).attr('show-date') ?? '', m[2]!) : null;
    if (!startsAt) return;
    const title = oneLine(a.clone().children().remove().end().text());
    entries.push({ orderId, startsAt, title, hall: m?.[1] || undefined });
  });
  // The page renders the list twice (two ticketing hosts); same ids.
  return uniqueBy(entries, (e) => e.orderId);
}

export function extractLessinShowUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();
  $('a[href*="/shows/"]').each((_, a) => {
    const url = absoluteUrl($(a).attr('href') ?? '', ORIGIN);
    if (!url) return;
    const u = new URL(url);
    const segments = u.pathname.split('/').filter(Boolean);
    if (/^(www\.)?lessin\.co\.il$/.test(u.hostname) && segments.length === 2 && segments[0] === 'shows') {
      urls.add(`${ORIGIN}/shows/${segments[1]}/`);
    }
  });
  return [...urls];
}

export type LessinRow = { orderId: string; dayMonthTime: string; hall?: string };

export type LessinShowPage = Omit<ScrapedShow, 'showtimes'> & { rows: LessinRow[] };

export function parseLessinShowPage(html: string, sourceUrl: string): LessinShowPage {
  const $ = cheerio.load(html);

  const h1 = $('h1').first();
  const name =
    oneLine(h1.clone().children('a').remove().end().text()) ||
    oneLine(($('meta[property="og:title"]').attr('content') ?? '').replace(/\s*[-–|]\s*תיאטרון בית ליסין\s*$/, ''));
  if (!name) throw new Error(`No title found on ${sourceUrl}`);

  const tagline = h1
    .parent()
    .find('.text p')
    .map((_, p) => oneLine($(p).text()))
    .get()
    .find(Boolean);

  // The about block is rendered twice (desktop + ".movile"); read the desktop one.
  const about = $('.show_expert').not('.movile').first();
  const paragraphs = about
    .find('.content p')
    .map((_, p) => {
      const copy = $(p).clone();
      copy.find('br').replaceWith('\n');
      return clean(copy.text());
    })
    .get()
    .filter((text) => text && !NOT_SYNOPSIS.test(text));
  const synopsis = paragraphs.join('\n\n') || clean($('meta[property="og:description"]').attr('content'));

  const credits: ScrapedPerson[] = [];
  const performers: ScrapedPerson[] = [];
  $('.talent_show .details_row').each((_, row) => {
    const role = oneLine($(row).find('.detail').text()).replace(/:$/, '').trim();
    const answer = $(row).find('.dtail_answer');
    const linked = answer.find('a').map((__, a) => oneLine($(a).text())).get().filter(Boolean);
    const names = (linked.length ? linked : [oneLine(answer.text())]).flatMap(splitNames);
    const target = PERFORMER_ROLE.test(role) ? performers : credits;
    // Cast rows list actors only, no characters — keep the role empty rather than "משתתפים".
    for (const personName of names) target.push({ name: personName, role: target === performers ? '' : role });
  });

  const images = [
    $('meta[property="og:image"]').attr('content'),
    ...$('.showslider .swiper-slide img').map((_, img) => $(img).attr('src')).get(),
  ]
    .filter((src): src is string => Boolean(src))
    .map((src) => absoluteUrl(fullSizeImage(src), ORIGIN))
    .filter((src): src is string => Boolean(src));

  const rows: LessinRow[] = [];
  $('.mainshow_list .mulrow').each((_, row) => {
    const orderId = $(row)
      .find('a[href]')
      .map((__, a) => ($(a).attr('href') ?? '').match(ORDER_ID)?.[1])
      .get()
      .find(Boolean);
    if (!orderId) return;
    const date = oneLine($(row).find('.mu1 a').text());
    const time = oneLine($(row).find('.mu2').text());
    const hall = oneLine($(row).find('.mu3.mc1').text()) || undefined;
    rows.push({ orderId, dayMonthTime: `${date} ${time}`, hall });
  });

  return {
    id: `lessin-${slugFromUrl(sourceUrl)}`,
    theaterId: 'lessin',
    sourceUrl,
    name,
    synopsis,
    images: [...new Set(images)],
    genreLabel: tagline,
    categories: categoriesFor(tagline, paragraphs[0], name),
    performers: uniqueBy(performers, (p) => p.name),
    credits: uniqueBy(credits, (p) => `${p.name}|${p.role}`),
    rows: uniqueBy(rows, (r) => r.orderId),
  };
}

/** Joins show pages with the home-page schedule. See the header comment for who decides what. */
export function buildLessinShows(pages: LessinShowPage[], home: HomeEntry[], now: Date = new Date()): ScrapedShow[] {
  const nowIso = israelNowIso(now);
  const homeById = new Map(home.map((entry) => [entry.orderId, entry]));
  const claimed = new Set<string>();

  const shows: ScrapedShow[] = pages.map(({ rows, ...page }) => {
    const showtimes: ScrapedShowtime[] = [];
    for (const row of rows) {
      const fromHome = homeById.get(row.orderId);
      const startsAt = fromHome?.startsAt ?? parseDayMonthTime(row.dayMonthTime, now);
      if (!startsAt) continue;
      claimed.add(row.orderId);
      showtimes.push({ id: `lessin-${row.orderId}`, startsAt, purchaseUrl: orderUrl(row.orderId), hall: row.hall ?? fromHome?.hall });
    }
    return { ...page, showtimes };
  });

  // Performances only the home page knows about: attach by title.
  const byTitle = new Map(shows.map((show) => [matchKey(show.name), show]));
  const unmatched = new Set<string>();
  for (const entry of home) {
    if (claimed.has(entry.orderId)) continue;
    const show = byTitle.get(matchKey(entry.title));
    if (!show) {
      unmatched.add(entry.title);
      continue;
    }
    show.showtimes.push({ id: `lessin-${entry.orderId}`, startsAt: entry.startsAt, purchaseUrl: orderUrl(entry.orderId), hall: entry.hall });
  }
  if (unmatched.size) console.warn(`[lessin] home-page performances with no matching show page: ${[...unmatched].join(', ')}`);

  for (const show of shows) {
    show.showtimes = uniqueBy(show.showtimes.filter((s) => s.startsAt >= nowIso), (s) => s.id).sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    );
    for (const showtime of show.showtimes) if (!showtime.hall) delete showtime.hall;
  }
  return shows;
}

// ---------------------------------------------------------------------------
// Network orchestration
// ---------------------------------------------------------------------------

export const lessinAdapter: Adapter = {
  theaterId: 'lessin',

  async scrape() {
    const home = parseLessinHome(await fetchText(HOME_URL));
    const urls = extractLessinShowUrls(await fetchText(LISTING_URL));
    if (urls.length === 0) throw new Error('[lessin] found no show URLs on the listing page');
    console.log(`[lessin] ${home.length} performances on the home page, ${urls.length} show pages to read`);

    const pages: LessinShowPage[] = [];
    let failures = 0;
    for (const url of urls) {
      try {
        pages.push(parseLessinShowPage(await fetchText(url), url));
      } catch (error) {
        failures++;
        console.warn(`[lessin] failed to read ${decodeURI(url)}:`, error instanceof Error ? error.message : error);
      }
    }
    if (failures > urls.length * 0.3) {
      throw new Error(`[lessin] ${failures}/${urls.length} show pages failed — the site layout probably changed`);
    }
    return buildLessinShows(pages, home);
  },
};
