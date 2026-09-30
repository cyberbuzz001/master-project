import { Request, Response, NextFunction } from 'express';

/**
 * Concurrency-cap load shedding.
 *
 * The app runs as a single Node process (one event loop shared by the REST API,
 * the WebSocket gateway, live tick ingestion, and the order-matching loop). Under
 * a burst of traffic on a heavy route, requests queue up waiting for event-loop
 * turns until nginx's own proxy_read_timeout gives up and the client sees a raw
 * 504 — or worse, a 502 if the process falls over. This middleware caps how many
 * requests for a given route can be in flight at once and fails fast with a
 * retryable 503 once that cap is hit, so an overloaded window degrades cleanly
 * instead of cascading into unexplained gateway errors.
 *
 * Scoped per-route (via a distinct `label`), not global, since different routes
 * have very different per-request costs.
 */
export function loadShed(label: string, maxConcurrent: number) {
  let inFlight = 0;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (inFlight >= maxConcurrent) {
      res.setHeader('Retry-After', '1');
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVER_BUSY',
          message: `Server is under heavy load (${label}). Please retry in a moment.`,
          retryAfterMs: 1000
        }
      });
      return;
    }

    inFlight++;
    let released = false;
    const release = () => {
      if (released) return; // 'finish' and 'close' can both fire for the same request — decrement once
      released = true;
      inFlight--;
    };
    res.on('finish', release);
    res.on('close', release);
    next();
  };
}
