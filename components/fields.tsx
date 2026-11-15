import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-md border border-input bg-background px-3 text-[15px] text-foreground placeholder:text-muted-foreground transition-colors hover:border-foreground/60 focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0 aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:hover:border-input";

export function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-destructive">
      {children}
    </p>
  );
}

type Common = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  className?: string;
};

function Label({
  id,
  label,
  required,
  hideLabel,
}: Pick<Common, "id" | "label" | "required" | "hideLabel">) {
  return (
    <label
      htmlFor={id}
      className={cn("mb-1.5 block text-sm font-medium text-foreground", hideLabel && "md:sr-only")}
    >
      {label}
      {required && (
        <span aria-hidden="true" className="ml-0.5 text-muted-foreground">
          *
        </span>
      )}
    </label>
  );
}

export function TextField({
  id,
  label,
  required,
  hint,
  error,
  hideLabel,
  className,
  ...rest
}: Common & Omit<InputHTMLAttributes<HTMLInputElement>, "id">) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <Label id={id} label={label} required={required} hideLabel={hideLabel} />
      <input
        id={id}
        name={id}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(control, "h-10")}
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

export function TextArea({
  id,
  label,
  hint,
  error,
  className,
  ...rest
}: Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ");
  return (
    <div className={className}>
      <Label id={id} label={label} />
      {hint && (
        <p id={`${id}-hint`} className="-mt-0.5 mb-2 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(control, "min-h-28 resize-y py-2.5 leading-relaxed")}
        {...rest}
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

export function Checkbox({
  id,
  label,
  checked,
  onChange,
  children,
  className,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1", className)}>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-3 py-1.5 text-[15px]">
        <input
          id={id}
          name={id}
          type="checkbox"
          className="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
      {children}
    </div>
  );
}

export function CountField({
  id,
  label,
  value,
  onChange,
  disabled,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  error?: string;
}) {
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-2">
        <label htmlFor={id} className="text-sm text-muted-foreground">
          Anzahl<span className="sr-only"> {label}</span>
        </label>
        <input
          id={id}
          name={id}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(control, "h-9 w-20 px-2.5 text-center")}
        />
      </span>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </span>
  );
}

export function Section({
  nr,
  title,
  children,
  id,
}: {
  nr: string;
  title: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <section aria-labelledby={`${id}-titel`} className="mt-14 first:mt-0">
      <h2 id={`${id}-titel`} className="mb-5 flex items-baseline gap-3 text-xl font-semibold tracking-tight">
        <span className="w-5 text-base font-medium text-muted-foreground">{nr}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
