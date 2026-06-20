export type CounterIcon =
  | "triangle"
  | "target"
  | "red"
  | "green"
  | "yellow"
  | "blue";

type CounterDef = {
  id: string;
  icon: CounterIcon;
  max?: number;
};

export type SectionDef = {
  id: string;
  variant: "plain" | "grouped";
  counters: CounterDef[];
};

export type CounterValues = Record<string, number>;

export const DEFAULT_MAX = 99;

export const sections: SectionDef[] = [
  {
    id: "s1",
    variant: "plain",
    counters: [{ id: "s1-triangle", icon: "triangle", max: 9999 }],
  },
  {
    id: "s2",
    variant: "grouped",
    counters: [
      { id: "s2-target", icon: "target" },
      { id: "s2-red", icon: "red" },
      { id: "s2-green", icon: "green" },
      { id: "s2-yellow", icon: "yellow" },
      { id: "s2-blue", icon: "blue" },
    ],
  },
  {
    id: "s3",
    variant: "grouped",
    counters: [
      { id: "s3-target", icon: "target" },
      { id: "s3-red", icon: "red" },
      { id: "s3-green", icon: "green" },
      { id: "s3-yellow", icon: "yellow" },
      { id: "s3-blue", icon: "blue" },
    ],
  },
];

export function counterIds(): string[] {
  return sections.flatMap((section) => section.counters.map((c) => c.id));
}

export function initialState(): CounterValues {
  return Object.fromEntries(counterIds().map((id) => [id, 0]));
}

export function resetAll(state: CounterValues): CounterValues {
  return Object.fromEntries(Object.keys(state).map((id) => [id, 0]));
}

export function maxFor(id: string): number {
  for (const section of sections) {
    for (const counter of section.counters) {
      if (counter.id === id) {
        return counter.max ?? DEFAULT_MAX;
      }
    }
  }
  return DEFAULT_MAX;
}
