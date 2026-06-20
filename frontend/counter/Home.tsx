import { useState } from "react";
import { type Mode } from "../lib/counter";
import { resetAll, sections, type CounterValues } from "../lib/state";
import { loadState, saveState } from "../lib/storage";
import { TrashIcon } from "../shell/icons";
import { CounterRow } from "./CounterRow";

export function Home() {
  const [values, setValues] = useState<CounterValues>(() =>
    loadState(localStorage),
  );
  const [mode, setMode] = useState<Mode>("increment");

  const update = (next: CounterValues) => {
    setValues(next);
    saveState(next, localStorage);
  };

  const setValue = (id: string, value: number) =>
    update({ ...values, [id]: value });

  const handleReset = () => {
    update(resetAll(values));
    setMode("increment");
  };

  return (
    <>
      <div className="mode-bar">
        <span className="mode-sign">+</span>
        <input
          type="checkbox"
          className="toggle"
          aria-label="モード切替"
          checked={mode === "decrement"}
          onChange={(e) =>
            setMode(e.target.checked ? "decrement" : "increment")
          }
        />
        <span className="mode-sign">−</span>
        {mode === "decrement" && (
          <button
            type="button"
            className="reset"
            aria-label="リセット"
            onClick={handleReset}
          >
            <TrashIcon />
          </button>
        )}
      </div>
      <main>
        {sections.map((section) => (
          <section key={section.id} className={`panel ${section.variant}`}>
            {section.counters.map((counter) => (
              <CounterRow
                key={counter.id}
                id={counter.id}
                icon={counter.icon}
                value={values[counter.id]}
                mode={mode}
                onChange={setValue}
              />
            ))}
          </section>
        ))}
      </main>
    </>
  );
}
