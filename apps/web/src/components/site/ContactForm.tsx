'use client';
import { useState } from 'react';
import { Send } from 'lucide-react';
import { contactSchema } from '@armyx/shared';
import { api, ApiError } from '@/lib/api';
import { TextArea, TextField, SelectField } from '@/components/ui/Field';
import { Turnstile } from '@/components/ui/Turnstile';
import { Alert } from '@/components/ui/Alert';

const SUBJECTS = [
  { value: 'general', label: 'General enquiry' }, { value: 'recruitment', label: 'Recruitment' }, { value: 'welfare', label: 'Welfare' },
  { value: 'media', label: 'Media / press' }, { value: 'procurement', label: 'Procurement' }, { value: 'report', label: 'Report misconduct or fraud' },
];

export function ContactForm() {
  const [v, setV] = useState({ name: '', email: '', phone: '', subject: '', message: '', website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [token, setToken] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = contactSchema.safeParse({ ...v, captchaToken: token || undefined });
    if (!parsed.success) {
      const f: Record<string, string> = {};
      for (const i of parsed.error.issues) f[String(i.path[0])] ??= i.message;
      setErrors(f);
      return;
    }
    setErrors({});
    setState('sending');
    try {
      await api('/contact', { body: parsed.data, maxRetries: 3 });
      setState('sent');
    } catch (err) {
      setState('error');
      setMsg(err instanceof ApiError && err.status === 429 ? 'You have sent several messages recently. Please try again later.' : (err as Error).message);
      if (err instanceof ApiError) setErrors(err.fields);
    }
  }

  if (state === 'sent') return <Alert tone="success" title="Message received">Thank you. Your message has been forwarded to the appropriate desk. For emergencies, call 193.</Alert>;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {state === 'error' && <Alert tone="error">{msg}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField label="Full name" required autoComplete="name" value={v.name} onChange={set('name')} error={errors.name} />
        <TextField label="Email address" type="email" required autoComplete="email" value={v.email} onChange={set('email')} error={errors.email} />
        <TextField label="Phone (optional)" type="tel" autoComplete="tel" value={v.phone} onChange={set('phone')} error={errors.phone} />
        <SelectField label="Subject" required options={SUBJECTS} value={v.subject} onChange={set('subject')} error={errors.subject} />
      </div>
      <TextArea label="Message" required value={v.message} onChange={set('message')} error={errors.message} hint="Do not include passwords, NIN or bank details." maxLength={4000} />
      {/* Honeypot — hidden from people and assistive tech */}
      <div aria-hidden className="absolute -left-[9999px]" >
        <label>Website<input tabIndex={-1} autoComplete="off" value={v.website} onChange={set('website')} /></label>
      </div>
      <Turnstile onToken={setToken} />
      <button className="btn-primary" disabled={state === 'sending'}><Send aria-hidden className="h-4 w-4" />{state === 'sending' ? 'Sending…' : 'Send message'}</button>
    </form>
  );
}
