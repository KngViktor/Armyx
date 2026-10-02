'use client';
import { Checkbox, SelectField, TextArea, TextField } from '@/components/ui/Field';
import type { FieldDef } from './steps';

export function StepForm({ fields, values, errors, onChange }: {
  fields: FieldDef[]; values: Record<string, any>; errors: Record<string, string>; onChange: (name: string, value: any) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {fields.filter((f) => !f.show || f.show(values)).map((f) => {
        const common = { label: f.label, required: f.required, error: errors[f.name], hint: f.hint };
        const val = values[f.name] ?? '';
        const span = f.half ? '' : 'sm:col-span-2';
        if (f.type === 'checkbox')
          return <div key={f.name} className="sm:col-span-2"><Checkbox label={f.label} checked={!!values[f.name]} onChange={(e) => onChange(f.name, e.target.checked)} error={errors[f.name]} /></div>;
        if (f.type === 'select' || (f.optionsFrom && f.type !== 'radio-cards'))
          return <div key={f.name} className={span}><SelectField {...common} options={f.optionsFrom ? f.optionsFrom(values) : f.options!} value={String(val)} onChange={(e) => onChange(f.name, e.target.value)} /></div>;
        if (f.type === 'textarea')
          return <div key={f.name} className={span}><TextArea {...common} autoComplete={f.autoComplete} value={val} onChange={(e) => onChange(f.name, e.target.value)} className="field-input min-h-24" /></div>;
        if (f.type === 'radio-cards')
          return (
            <fieldset key={f.name} className="sm:col-span-2">
              <legend className="field-label">{f.label} <span aria-hidden className="text-danger">*</span></legend>
              <div className="grid gap-3 md:grid-cols-3">
                {f.options!.map((o) => (
                  <label key={o.value} className={`cursor-pointer rounded-lg border-2 p-4 transition ${val === o.value ? 'border-olive-700 bg-olive-50' : 'border-olive-100 hover:border-khaki-500'}`}>
                    <input type="radio" name={f.name} value={o.value} checked={val === o.value} onChange={() => onChange(f.name, o.value)} className="mr-2 accent-olive-700" />
                    <span className="font-semibold text-olive-900">{o.label}</span>
                    {o.description && <span className="mt-1 block text-sm text-muted">{o.description}</span>}
                  </label>
                ))}
              </div>
              {errors[f.name] && <p className="mt-1 text-sm font-medium text-danger">{errors[f.name]}</p>}
            </fieldset>
          );
        return (
          <div key={f.name} className={span}>
            <TextField {...common} type={f.type === 'tel' ? 'tel' : f.type} inputMode={f.inputMode} autoComplete={f.autoComplete} min={f.min} max={f.max} value={val} onChange={(e) => onChange(f.name, e.target.value)} />
          </div>
        );
      })}
    </div>
  );
}
