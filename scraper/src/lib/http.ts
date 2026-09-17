/**
 * The only way adapters touch the network: identified, slow, and retried.
 * One request at a time *per site* with a pause between them — a couple of
 * hundred pages twice a day is invisible to the theaters' servers, and
 * that's the point. Different sites don't wait for each other.
 */

const DELAY_MS = 1500;
const RETRIES = 2;
const TIMEOUT_MS = 30_000;

const contact = process.env.SCRAPER_CONTACT ?? 'unknown';
const USER_AGENT = `showmi-scraper/1.0 (+contact: ${contact})`;

const queues = new Map<string, Promise<void>>();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Resolves when it's this caller's turn on `host`, and reserves the next slot. */
function takeTurn(host: string): Promise<void> {
  const previous = queues.get(host) ?? Promise.resolve();
  const turn = previous.then(() => undefined);
  queues.set(host, turn.then(() => sleep(DELAY_MS)));
  return turn;
}

export class HttpError extends Error {
  constructor(readonly url: string, readonly status: number) {
    super(`HTTP ${status} for ${url}`);
  }
}

const retryable = (status: number) => status >= 500 || status === 429;

export async function fetchText(url: string): Promise<string> {
  const host = new URL(url).host;
  for (let attempt = 0; ; attempt++) {
    await takeTurn(host);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'he-IL,he;q=0.9' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) return await res.text();
      throw new HttpError(url, res.status);
    } catch (error) {
      const canRetry = !(error instanceof HttpError) || retryable(error.status);
      if (!canRetry || attempt >= RETRIES) throw error;
    }
    await sleep(DELAY_MS * 2 ** (attempt + 1));
  }
}
