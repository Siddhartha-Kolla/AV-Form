import type { ChangeEvent, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const control =
  "w-full rounded-md border border-input bg-surface px-3.5 text-[15px] text-foreground shadow-[0_1px_1px_rgb(0_0_0/0.04)] placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-150 hover:border-foreground/50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

export function FieldError({ id, children, className }: { id: string; children?: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p id={id} className={cn("mt-1.5 text-sm text-destructive", className)}>
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
      className={cn("mb-2 block text-sm font-medium text-foreground", hideLabel && "md:sr-only")}
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
        className={cn(control, "h-11")}
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
        <p id={`${id}-hint`} className="-mt-1 mb-2.5 text-sm leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
      <textarea
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(control, "min-h-32 resize-y py-3 leading-relaxed")}
        {...rest}
      />
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

export function SelectField({
  id,
  label,
  children,
  defaultValue,
  disabled,
  className,
  hint,
  name,
  value,
  onChange,
}: Common & {
  children: ReactNode;
  defaultValue?: string;
  disabled?: boolean;
  name?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className={className}>
      <Label id={id} label={label} />
      <select
        id={id}
        name={name ?? id}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={cn(control, "select h-11")}
      >
        {children}
      </select>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Auswahlzeile: die ganze Zeile ist klickbar und hat eine feste Höhe.
 * Rechts kann ein Zusatzfeld sitzen (Anzahl), ohne dass die Zeile springt.
 */
export function Checkbox({
  id,
  label,
  checked,
  onChange,
  aside,
  below,
  className,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  aside?: ReactNode;
  below?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="-mx-3 flex min-h-11 items-center justify-between gap-3 rounded-md px-3 transition-colors hover:bg-muted">
        <label htmlFor={id} className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 text-[15px]">
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
        {aside}
      </div>
      {below}
    </div>
  );
}

export function CountField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  return (
    <span className="flex shrink-0 items-center gap-2">
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
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(control, "h-8 w-16 px-2 text-center")}
      />
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
      <h2 id={`${id}-titel`} className="mb-6 flex items-baseline gap-3 text-xl font-semibold tracking-tight">
        <span className="w-5 text-base font-medium text-muted-foreground">{nr}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
