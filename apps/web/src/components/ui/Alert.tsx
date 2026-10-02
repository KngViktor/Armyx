import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

const STYLES = {
  info: { cls: 'border-olive-600/30 bg-olive-50 text-olive-900', Icon: Info },
  success: { cls: 'border-success/30 bg-green-50 text-success', Icon: CheckCircle2 },
  warning: { cls: 'border-gold-600/40 bg-khaki-100 text-olive-950', Icon: AlertTriangle },
  error: { cls: 'border-danger/30 bg-red-50 text-danger', Icon: XCircle },
};

export function Alert({ tone = 'info', title, children }: { tone?: keyof typeof STYLES; title?: string; children?: ReactNode }) {
  const { cls, Icon } = STYLES[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-lg border p-4 text-sm ${cls}`}>
      <Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
      </div>
    </div>
  );
}
