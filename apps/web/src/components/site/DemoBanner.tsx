'use client';
/** Shown on every page of demo/preview builds (NEXT_PUBLIC_DEMO_MODE=true). */
import { DEMO } from '@/lib/api';

export function DemoBanner() {
  if (!DEMO) return null;
  const reset = async () => {
    const { resetDemo } = await import('@/lib/demo/store');
    resetDemo();
    location.href = '/';
  };
  return (
    <div role="note" className="relative z-[70] bg-danger px-4 py-2 text-center text-xs font-semibold text-white sm:text-sm">
      DEMONSTRATION PREVIEW — not an official Nigerian Army website. Do not enter real personal data: everything you type stays in this browser only.{' '}
      <button type="button" onClick={reset} className="underline">Reset demo data</button>
    </div>
  );
}

export function DemoHint({ children }: { children: React.ReactNode }) {
  if (!DEMO) return null;
  return <div className="rounded-lg border-2 border-dashed border-gold-500 bg-khaki-100/60 p-3 text-sm text-olive-950"><strong>Demo:</strong> {children}</div>;
}
