import { type ElementType, type MouseEvent, type ReactNode } from "react";

export function Overlay({
  overlayClassName,
  contentClassName,
  ariaLabel,
  contentTag: Content = "div",
  onClose,
  children,
}: {
  overlayClassName: string;
  contentClassName: string;
  ariaLabel: string;
  contentTag?: ElementType;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className={overlayClassName} aria-label={ariaLabel} onClick={onClose}>
      <Content
        className={contentClassName}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {children}
      </Content>
    </div>
  );
}
