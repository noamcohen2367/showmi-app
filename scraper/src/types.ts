/**
 * The one shape every theater adapter must return.
 *
 * Adapters differ wildly in *how* they get the data (server-rendered pages,
 * a JSON blob embedded in a page, a home-page schedule joined with show
 * pages); nothing past the adapter knows or cares. Everything here is already
 * normalised: absolute URLs, Israel wall-clock times, app categories.
 */

export type TheaterId = 'habima' | 'cameri' | 'lessin';

export type ScrapedPerson = {
  name: string;
  /** Character for cast, job for creative team; '' when the site gives none. */
  role: string;
  photoUrl?: string;
  /** The person's page on the theater site, when it has one. */
  profileUrl?: string;
};

export type ScrapedShowtime = {
  /** '<theater>-<Pres Global order id>' — stable across runs. */
  id: string;
  /** 'YYYY-MM-DDTHH:mm:00', Asia/Jerusalem wall clock, no offset. */
  startsAt: string;
  purchaseUrl: string;
  hall?: string;
  /** e.g. 'English subtitles' — Cameri only, for now. */
  subtitles?: string;
};

export type ScrapedShow = {
  id: string;
  theaterId: TheaterId;
  sourceUrl: string;
  name: string;
  synopsis: string;
  /** Portrait poster first when the site has one, then production photos. */
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
