import { sanitizeInput } from "../lib/sanitize";

export function NumericInput({
  value,
  max,
  onChange,
  className,
  ariaLabel,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  className: string;
  ariaLabel: string;
}) {
  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(sanitizeInput(e.target.value, max))}
    />
  );
}
