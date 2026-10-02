/**
 * Pod-level admission control. If a pod already has MAX_INFLIGHT requests in
 * progress it answers immediately with 503 + Retry-After instead of queueing
 * work it cannot finish (which would cascade into timeouts everywhere).
 * The portal UI turns this into a friendly "you are in the queue" screen and
 * retries with jittered backoff. The edge waiting room keeps this rare.
 */
import type { NextFunction, Request, Response } from 'express';
import { Gauge, Counter } from 'prom-client';

export const inflightGauge = new Gauge({ name: 'armyx_http_inflight', help: 'In-flight HTTP requests' });
const shedCounter = new Counter({ name: 'armyx_http_shed_total', help: 'Requests rejected by load shedding' });

export function loadShed(max: number) {
  let inflight = 0;
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path.endsWith('/health/live') || req.path.endsWith('/health/ready')) return next();
    if (inflight >= max) {
      shedCounter.inc();
      res.setHeader('Retry-After', String(2 + Math.floor(Math.random() * 4)));
      res.status(503).json({ statusCode: 503, message: 'High demand. You are in the queue — retrying shortly.', queued: true });
      return;
    }
    inflight++;
    inflightGauge.set(inflight);
    let done = false;
    const release = () => {
      if (done) return;
      done = true;
      inflight--;
      inflightGauge.set(inflight);
    };
    res.on('finish', release);
    res.on('close', release);
    next();
  };
}
