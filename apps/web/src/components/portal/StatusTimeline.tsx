import { Check, X } from 'lucide-react';
import { STATUS_LABELS, type ApplicationStatus } from '@armyx/shared';

const ORDER: ApplicationStatus[] = ['submitted', 'under_review', 'shortlisted', 'invited_for_screening'];

export function StatusTimeline({ status }: { status: ApplicationStatus | 'processing' }) {
  const rejected = status === 'rejected';
  const current = status === 'processing' ? 0 : ORDER.indexOf(status as ApplicationStatus);
  const steps = rejected ? (['submitted', 'under_review', 'rejected'] as ApplicationStatus[]) : ORDER;
  const idx = rejected ? 2 : current;
  return (
    <ol className="grid gap-4 sm:grid-cols-4" aria-label="Application progress">
      {steps.map((s, i) => {
        const done = i < idx || (i === idx && !rejected);
        const isCurrent = i === idx;
        return (
          <li key={s} className="flex items-center gap-3 sm:flex-col sm:text-center" aria-current={isCurrent ? 'step' : undefined}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${rejected && isCurrent ? 'border-danger bg-danger text-white' : done ? 'border-olive-700 bg-olive-700 text-gold-300' : 'border-khaki-500 bg-white text-muted'}`}>
              {rejected && isCurrent ? <X aria-hidden className="h-5 w-5" /> : done ? <Check aria-hidden className="h-5 w-5" /> : i + 1}
            </span>
            <span className={`text-sm ${isCurrent ? 'font-semibold text-olive-900' : 'text-muted'}`}>{STATUS_LABELS[s]}{status === 'processing' && i === 0 ? ' (processing)' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}
