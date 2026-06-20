export function sanitizeInput(raw: string, max: number): number {
  if (!/^\d+$/.test(raw)) {
    return 0;
  }
  return Math.min(max, Number(raw));
}
