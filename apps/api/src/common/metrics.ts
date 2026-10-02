/**
 * Prometheus metrics. Exposed on a separate port (METRICS_PORT) that is only
 * reachable inside the cluster — never through the public ingress.
 * `armyx_http_requests_total` also drives request-based autoscaling (KEDA).
 */
import http from 'node:http';
import type { NextFunction, Request, Response } from 'express';
import { Counter, Histogram, collectDefaultMetrics, register } from 'prom-client';

collectDefaultMetrics({ prefix: 'armyx_api_' });

const duration = new Histogram({
  name: 'armyx_http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});
const total = new Counter({
  name: 'armyx_http_requests_total',
  help: 'HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const end = duration.startTimer();
  res.on('finish', () => {
    // Use the route template (e.g. /api/v1/admin/applicants/:id) to keep label cardinality bounded.
    const route = (req.route?.path as string | undefined) ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    const labels = { method: req.method, route, status: String(res.statusCode) };
    end(labels);
    total.inc(labels);
  });
  next();
}

export function startMetricsServer(port: number) {
  http
    .createServer(async (req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', register.contentType);
        res.end(await register.metrics());
      } else {
        res.statusCode = 404;
        res.end();
      }
    })
    .listen(port);
}
