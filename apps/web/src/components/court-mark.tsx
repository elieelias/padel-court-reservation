export function CourtMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "court-mark court-mark--compact" : "court-mark"} aria-hidden="true">
      <span className="court-mark__service" />
      <span className="court-mark__net" />
    </span>
  );
}
