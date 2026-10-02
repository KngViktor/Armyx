'use client';
/**
 * Cloudflare Turnstile bot check. Renders nothing when no site key is
 * configured (local development); the API also skips verification then.
 */
import Script from 'next/script';
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);

  const render = () => {
    if (!SITE_KEY || rendered.current || !ref.current || !window.turnstile) return;
    rendered.current = true;
    window.turnstile.render(ref.current, { sitekey: SITE_KEY, callback: onToken, 'expired-callback': () => onToken(''), theme: 'light' });
  };

  useEffect(render);
  if (!SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={render} />
      <div ref={ref} className="min-h-16" />
    </>
  );
}
export const captchaEnabled = !!SITE_KEY;
