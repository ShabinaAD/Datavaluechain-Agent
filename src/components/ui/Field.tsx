import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const CONTROL =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function TextInput({ label, hint, className, id, ...props }: TextInputProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      <input id={id} className={cn(CONTROL, className)} {...props} />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export function TextArea({ label, hint, className, id, rows = 4, ...props }: TextAreaProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      <textarea id={id} rows={rows} className={cn(CONTROL, 'resize-y', className)} {...props} />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
}

export function Select({ label, hint, className, id, children, ...props }: SelectProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      <select id={id} className={cn(CONTROL, 'cursor-pointer', className)} {...props}>
        {children}
      </select>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
