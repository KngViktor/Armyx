'use client';
/** Lightweight password guidance (the API enforces the actual policy). */
export function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const checks = [value.length >= 10, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value), value.length >= 16];
  const score = Math.min(4, checks.filter(Boolean).length);
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colours = ['bg-danger', 'bg-danger', 'bg-gold-500', 'bg-olive-500', 'bg-success'];
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded ${i < score ? colours[score] : 'bg-olive-100'}`} />)}</div>
      <p className="mt-1 text-xs text-muted">Password strength: {labels[score]}. Use 10+ characters with upper and lower case, a number and a symbol.</p>
    </div>
  );
}
