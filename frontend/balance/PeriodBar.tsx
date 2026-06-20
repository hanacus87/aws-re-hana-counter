export function PeriodBar({
  label,
  prevLabel,
  nextLabel,
  onPrev,
  onNext,
}: {
  label: string;
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="period-bar">
      <button
        type="button"
        className="period-nav"
        aria-label={prevLabel}
        onClick={onPrev}
      >
        ‹
      </button>
      <span className="period-label">{label}</span>
      <button
        type="button"
        className="period-nav"
        aria-label={nextLabel}
        onClick={onNext}
      >
        ›
      </button>
    </div>
  );
}
