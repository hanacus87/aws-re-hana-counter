import { useState } from "react";
import { MAX_AMOUNT } from "../lib/balance";
import { NumericInput } from "../shell/NumericInput";
import { Overlay } from "../shell/Overlay";

export function DayEditor({
  date,
  record,
  onSave,
  onDelete,
  onCancel,
}: {
  date: string;
  record: { bet: number; recovery: number } | null;
  onSave: (date: string, bet: number, recovery: number) => void;
  onDelete: (date: string) => void;
  onCancel: () => void;
}) {
  const [bet, setBet] = useState(record ? record.bet : 0);
  const [recovery, setRecovery] = useState(record ? record.recovery : 0);
  return (
    <Overlay
      overlayClassName="modal-overlay"
      contentClassName="modal"
      ariaLabel="閉じる"
      onClose={onCancel}
    >
      <div className="modal-field">
        <span className="field-label">投資</span>
        <NumericInput
          className="amount-input"
          ariaLabel="投資"
          value={bet}
          max={MAX_AMOUNT}
          onChange={setBet}
        />
      </div>
      <div className="modal-field">
        <span className="field-label">回収</span>
        <NumericInput
          className="amount-input"
          ariaLabel="回収"
          value={recovery}
          max={MAX_AMOUNT}
          onChange={setRecovery}
        />
      </div>
      <div className="modal-actions">
        <button type="button" aria-label="キャンセル" onClick={onCancel}>
          キャンセル
        </button>
        {record && (
          <button
            type="button"
            aria-label="削除"
            onClick={() => onDelete(date)}
          >
            削除
          </button>
        )}
        <button
          type="button"
          aria-label="保存"
          onClick={() => onSave(date, bet, recovery)}
        >
          保存
        </button>
      </div>
    </Overlay>
  );
}
