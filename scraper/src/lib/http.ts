/**
 * The only way adapters touch the network: identified, slow, and retried.
 * One request at a time with a pause between them — a few dozen pages twice
 * a day is invisible to the theaters' servers, and that's the point.
 */

const DELAY_MS = 1500;
const RETRIES = 2;
const TIMEOUT_MS = 20_000;

const contact = process.env.SCRAPER_CONTACT ?? 'unknown';
const USER_AGENT = `showmi-scraper/1.0 (+contact: ${contact})`;

let lastRequestAt = 0;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchText(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'he-IL,he;q=0.9' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return await res.text();
      // 4xx won't fix itself on retry; 5xx and 429 might.
      if (res.status < 500 && res.status !== 429) throw new HttpError(url, res.status);
      if (attempt >= RETRIES) throw new HttpError(url, res.status);
    } catch (error) {
      if (error instanceof HttpError && error.status < 500 && error.status !== 429) throw error;
      if (attempt >= RETRIES) throw error;
    }
    await sleep(DELAY_MS * 2 ** (attempt + 1));
  }
}

export class HttpError extends Error {
  constructor(readonly url: string, readonly status: number) {
    super(`HTTP ${status} for ${url}`);
  }
}
