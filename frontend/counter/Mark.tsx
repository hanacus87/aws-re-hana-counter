import { type CounterIcon } from "../lib/state";

const MARK_CLASS: Record<CounterIcon, string> = {
  triangle: "mark-triangle",
  target: "mark-target",
  red: "mark-dot mark-red",
  green: "mark-dot mark-green",
  yellow: "mark-dot mark-yellow",
  blue: "mark-dot mark-blue",
};

export function Mark({ icon }: { icon: CounterIcon }) {
  return <span className={MARK_CLASS[icon]} />;
}
