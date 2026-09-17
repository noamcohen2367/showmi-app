/**
 * The one shape every theater adapter must return.
 *
 * Adapters differ wildly in *how* they get the data (HTML pages, AJAX JSON,
 * a headless browser); nothing past the adapter knows or cares. Everything
 * here is already normalised: absolute URLs, local Israel wall-clock times,
 * app categories.
 */

export type TheaterId = 'habima' | 'cameri' | 'lessin';

export type ScrapedPerson = { name: string; role: string };

export type ScrapedShowtime = {
  /** '<theater>-<ticketing order id>' — stable across runs. */
  id: string;
  /** 'YYYY-MM-DDTHH:mm:00', Asia/Jerusalem wall clock, no offset. */
  startsAt: string;
  purchaseUrl: string;
  hall?: string;
};

export type ScrapedShow = {
  id: string;
  theaterId: TheaterId;
  sourceUrl: string;
  name: string;
  synopsis: string;
  images: string[];
  genreLabel?: string;
  categories: string[];
  performers: ScrapedPerson[];
  credits: ScrapedPerson[];
  showtimes: ScrapedShowtime[];
};

export type Adapter = {
  theaterId: TheaterId;
  scrape(): Promise<ScrapedShow[]>;
};
