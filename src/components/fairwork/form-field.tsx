import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string };
export function FormField({ id, label, error, "aria-describedby": describedBy, ...props }: Props) {
  const description = [describedBy, error ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined;
  return <div>
    <label htmlFor={id}>{label}</label>
    <input {...props} id={id} aria-invalid={error ? true : undefined} aria-describedby={description} />
    {error && <p id={`${id}-error`} role="alert">{error}</p>}
  </div>;
}
