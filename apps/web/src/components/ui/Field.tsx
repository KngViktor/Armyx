'use client';
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface Common {
  label: string;
  error?: string;
  hint?: ReactNode;
}

function Wrap({ id, label, error, hint, required, children }: Common & { id: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label} {required && <span aria-hidden className="text-danger">*</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: ReactNode) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

export function TextField({ label, error, hint, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} error={error} hint={hint} required={props.required}>
      <input id={id} className="field-input" aria-invalid={!!error} aria-describedby={describedBy(id, error, hint)} {...props} />
    </Wrap>
  );
}

export function SelectField({ label, error, hint, options, placeholder = 'Select…', ...props }: Common & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  const id = useId();
  return (
    <Wrap id={id} label={label} error={error} hint={hint} required={props.required}>
      <select id={id} className="field-input" aria-invalid={!!error} aria-describedby={describedBy(id, error, hint)} {...props}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Wrap>
  );
}

export function TextArea({ label, error, hint, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} error={error} hint={hint} required={props.required}>
      <textarea id={id} className="field-input min-h-32" aria-invalid={!!error} aria-describedby={describedBy(id, error, hint)} {...props} />
    </Wrap>
  );
}

export function Checkbox({ label, error, ...props }: { label: ReactNode; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <div className="flex items-start gap-3">
        <input id={id} type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-olive-700" aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} {...props} />
        <label htmlFor={id} className="text-sm text-ink">{label}</label>
      </div>
      {error && <p id={`${id}-err`} className="mt-1 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
