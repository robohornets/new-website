import type { ReactNode } from "react";

export const inputClass =
  "h-11 w-full rounded-md border border-edge bg-ink px-3 text-[15px] text-bone placeholder:text-ash focus:border-hornet focus:outline-none";

function Label({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 text-sm font-semibold ${className}`}>
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-dust">{hint}</span>}
    </label>
  );
}

export function TextField({
  label,
  name,
  defaultValue,
  hint,
  type = "text",
  required,
  placeholder,
  className,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  hint?: ReactNode;
  type?: "text" | "url" | "email" | "number" | "date" | "datetime-local";
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Label label={label} hint={hint} className={className}>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        className={inputClass}
      />
    </Label>
  );
}

export function TextArea({
  label,
  name,
  defaultValue,
  hint,
  rows = 4,
  placeholder,
  mono,
  className,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  hint?: ReactNode;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <Label label={label} hint={hint} className={className}>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={rows}
        placeholder={placeholder}
        className={`${inputClass} h-auto py-2.5 leading-relaxed ${mono ? "font-mono text-sm" : ""}`}
      />
    </Label>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  options,
  hint,
  className,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  options: { value: string | number; label: string }[];
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <Label label={label} hint={hint} className={className}>
      <select name={name} defaultValue={defaultValue ?? ""} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Label>
  );
}

export function Checkbox({ label, name, defaultChecked, hint }: { label: string; name: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-3 text-[15px]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-5 shrink-0 accent-hornet" />
      <span className="flex flex-col gap-0.5">
        {label}
        {hint && <span className="text-xs text-dust">{hint}</span>}
      </span>
    </label>
  );
}

export function Panel({ title, description, children, actions }: { title?: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-md border border-line bg-panel p-5 md:p-6">
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {title && <h2 className="font-display text-2xl font-bold uppercase">{title}</h2>}
            {description && <p className="text-sm text-dust">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function AdminPageHeader({ title, description, actions, breadcrumb }: { title: string; description?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1.5">
        {breadcrumb && <div className="text-[13px] text-dust">{breadcrumb}</div>}
        <h1 className="font-display text-4xl leading-none font-extrabold uppercase md:text-[44px]">{title}</h1>
        {description && <p className="text-sm text-dust">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

export function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-2 xl:grid-cols-4" }[cols];
  return <div className={`grid gap-4 ${c}`}>{children}</div>;
}
