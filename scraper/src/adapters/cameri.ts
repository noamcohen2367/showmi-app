/**
 * Cameri (cameri.co.il) — verified against the live site, Sept 2026.
 *
 * The schedule page embeds the whole season (~6 months, 340+ date entries)
 * as a JSON literal: `let calendarEvents = [...]`. One entry per show per
 * day, with each performance as a tuple:
 *
 *   [wpEventId, "18:30", "כתוביות בעברית", "45391", subtitleTermId, "קאמרי 1"]
 *                                           ^ Pres Global id → tickets.cameri.co.il/order/45391
 *
 * plus show name, summary, a vertical and a horizontal image, category, and
 * actor ids whose names are the <option>s of the page's actor filter.
 *
 * That alone is a complete catalogue. Each show page then adds what the JSON
 * lacks — full synopsis, creative team with roles, cast headshots, gallery —
 * and is fetched as a best-effort enrichment: if it fails, the show still
 * ships with the JSON data.
 */

import * as cheerio from 'cheerio';

import { categoriesFor } from '../lib/categories.js';
import { combineDateAndTime, israelNowIso } from '../lib/dates.js';
import { fetchText } from '../lib/http.js';
import {
  absoluteUrl,
  clean,
  decodeEntities,
  fullSizeImage,
  oneLine,
  slugFromUrl,
  splitNames,
  uniqueBy,
} from '../lib/text.js';
import type { Adapter, ScrapedPerson, ScrapedShow, ScrapedShowtime } from '../types.js';

const ORIGIN = 'https://www.cameri.co.il';
// The exact URL the calendar was verified on; the embedded JSON holds every category regardless of the filter.
const SCHEDULE_URL = `${ORIGIN}/${encodeURIComponent('לוח-הופעות')}/?filter=show`;

/** Categories that aren't performances for the public (courses, student showcases). */
const EXCLUDED_CATEGORIES = new Set(['ACADEMY', 'אקדמי']);

type CalendarTime = [wpId: number, time: string, subtitles: string, presGlobalId: string, subtitleTermId: number | '', hall: string];

export type CalendarEvent = {
  start: string;
  extendedProps: {
    times: CalendarTime[];
    image?: string;
    image_horizontal?: string;
    show_name: string;
    summary?: string;
    show_permalink: string;
    category_name?: string;
    actors?: number[];
    directors?: string[];
    writers?: string[];
  };
};

// ---------------------------------------------------------------------------
// Pure parsing
// ---------------------------------------------------------------------------

/**
 * Pulls the array literal out of `let calendarEvents = [...]` by bracket
 * matching (string-aware), so trailing code on the same line doesn't matter.
 */
export function extractCalendarEvents(html: string): CalendarEvent[] {
  const marker = html.search(/\b(?:let|var|const)\s+calendarEvents\s*=/);
  if (marker === -1) throw new Error('calendarEvents not found on the Cameri schedule page');
  const start = html.indexOf('[', marker);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return JSON.parse(html.slice(start, i + 1)) as CalendarEvent[];
  }
  throw new Error('calendarEvents array is not terminated');
}

/** The actor filter's <option value="576">אבי טרמין</option> list, as id → name. */
export function extractActorNames(html: string): Map<number, string> {
  const $ = cheerio.load(html);
  const names = new Map<number, string>();
  $('option[value]').each((_, option) => {
    const id = Number($(option).attr('value'));
    const name = oneLine($(option).text());
    if (Number.isInteger(id) && id > 0 && name) names.set(id, name);
  });
  return names;
}

export function parseCalendar(html: string, now: Date = new Date()): ScrapedShow[] {
  const events = extractCalendarEvents(html);
  const actorNames = extractActorNames(html);
  const nowIso = israelNowIso(now);
  const shows = new Map<string, ScrapedShow>();

  for (const event of events) {
    const p = event.extendedProps;
    if (!p?.show_permalink || EXCLUDED_CATEGORIES.has(p.category_name ?? '')) continue;
    const sourceUrl = absoluteUrl(p.show_permalink, ORIGIN);
    if (!sourceUrl) continue;

    let show = shows.get(sourceUrl);
    if (!show) {
      const summary = clean(decodeEntities(p.summary ?? ''));
      const firstLine = summary.split('\n')[0];
      show = {
        id: `cameri-${slugFromUrl(sourceUrl)}`,
        theaterId: 'cameri',
        sourceUrl,
        name: oneLine(decodeEntities(p.show_name)),
        synopsis: summary,
        images: [p.image, p.image_horizontal]
          .filter((src): src is string => Boolean(src))
          .map((src) => absoluteUrl(fullSizeImage(src), ORIGIN)!)
          .filter((src, i, all) => all.indexOf(src) === i),
        genreLabel: firstLine || undefined,
        // `category_name` is Cameri's own taxonomy value, so it counts as a
        // label alongside the headline. The synopsis goes in as prose.
        categories: categoriesFor({
          label: [firstLine, p.category_name].filter(Boolean).join(' '),
          prose: summary,
        }),
        performers: (p.actors ?? [])
          .map((id) => actorNames.get(id))
          .filter((name): name is string => Boolean(name))
          .map((name) => ({ name, role: '' })),
        credits: [
          ...(p.writers ?? []).map((name) => ({ name: oneLine(decodeEntities(name)), role: 'מאת' })),
          ...(p.directors ?? []).map((name) => ({ name: oneLine(decodeEntities(name)), role: 'בימוי' })),
        ],
        showtimes: [],
      };
      shows.set(sourceUrl, show);
    }

    for (const [, time, subtitles, presGlobalId, , hall] of p.times ?? []) {
      const startsAt = combineDateAndTime(event.start, time);
      if (!startsAt || startsAt < nowIso || !/^\d+$/.test(String(presGlobalId))) continue;
      const showtime: ScrapedShowtime = {
        id: `cameri-${presGlobalId}`,
        startsAt,
        purchaseUrl: `https://tickets.cameri.co.il/order/${presGlobalId}`,
      };
      if (oneLine(hall)) showtime.hall = oneLine(hall);
      if (oneLine(subtitles)) showtime.subtitles = oneLine(subtitles);
      show.showtimes.push(showtime);
    }
  }

  for (const show of shows.values()) {
    show.showtimes = uniqueBy(show.showtimes, (s) => s.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }
  return [...shows.values()];
}

export type CameriShowDetails = {
  synopsis: string;
  credits: ScrapedPerson[];
  performers: ScrapedPerson[];
  gallery: string[];
};

export function parseCameriShowPage(html: string): CameriShowDetails {
  const $ = cheerio.load(html);

  const synopsis = $('.about-show .show-content p')
    .map((_, p) => {
      const copy = $(p).clone();
      copy.find('br').replaceWith('\n');
      return clean(copy.text());
    })
    .get()
    .filter(Boolean)
    .join('\n\n');

  const credits = $('.creators-list .creator-item')
    .toArray()
    .flatMap((item) => {
      const role = oneLine($(item).find('.creator-role').text());
      return splitNames($(item).find('.creator-name').text()).map((name) => ({ name, role }));
    });

  const performers = $('section.actors .actor-item')
    .toArray()
    .map((item): ScrapedPerson | null => {
      const name = oneLine($(item).find('.actor-name').text());
      if (!name) return null;
      const photo = $(item).find('img').attr('src');
      return {
        name,
        role: '',
        photoUrl: photo ? absoluteUrl(fullSizeImage(photo), ORIGIN) ?? undefined : undefined,
        profileUrl: absoluteUrl($(item).find('a').attr('href') ?? '', ORIGIN) ?? undefined,
      };
    })
    .filter((p): p is ScrapedPerson => p !== null);

  const gallery = $('.gallery-thumbs img')
    .map((_, img) => $(img).attr('src'))
    .get()
    .map((src) => absoluteUrl(fullSizeImage(src), ORIGIN))
    .filter((src): src is string => Boolean(src));

  return { synopsis, credits, performers, gallery };
}

/** Page data wins where it's richer; the JSON stays as the fallback. */
export function mergeCameriDetails(show: ScrapedShow, details: CameriShowDetails): ScrapedShow {
  const synopsis = details.synopsis || show.synopsis;

  return {
    ...show,
    synopsis,
    // Recomputed, not carried over. The categories built in `parseCameriCalendar`
    // only had the calendar's one-line `summary` to go on; the full synopsis
    // arrives here, and it is what mentions "מחזמר" or "קומדיה" for a good
    // number of shows. Leaving the calendar's answer in place left 15 shows
    // uncategorised that the page itself categorises perfectly well.
    categories: categoriesFor({
      label: [show.genreLabel, show.name].filter(Boolean).join(' '),
      prose: synopsis,
    }),
    credits: details.credits.length ? details.credits : show.credits,
    performers: details.performers.length ? details.performers : show.performers,
    images: [...new Set([...show.images, ...details.gallery])],
  };
}

// ---------------------------------------------------------------------------
// Network orchestration
// ---------------------------------------------------------------------------

export const cameriAdapter: Adapter = {
  theaterId: 'cameri',

  async scrape() {
    const shows = parseCalendar(await fetchText(SCHEDULE_URL));
    console.log(`[cameri] ${shows.length} shows in the embedded calendar; reading show pages for details`);

    let failures = 0;
    const enriched: ScrapedShow[] = [];
    for (const show of shows) {
      try {
        enriched.push(mergeCameriDetails(show, parseCameriShowPage(await fetchText(show.sourceUrl))));
      } catch (error) {
        failures++;
        enriched.push(show); // the calendar data is still complete enough to publish
        console.warn(`[cameri] details failed for ${show.name}:`, error instanceof Error ? error.message : error);
      }
    }
    if (failures) console.warn(`[cameri] ${failures}/${shows.length} show pages failed; those shows use calendar data only`);
    return enriched;
  },
};
