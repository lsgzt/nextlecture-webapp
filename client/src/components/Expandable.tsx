import type { ReactNode } from "react";

type ExpandableProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
  id?: string;
};

/**
 * Height-animated expand/collapse wrapper.
 * Keeps content mounted so open/close can animate smoothly.
 */
export function Expandable({ open, children, className = "", id }: ExpandableProps) {
  return (
    <div
      id={id}
      className={`expand-panel ${className}`.trim()}
      data-open={open ? "true" : "false"}
      aria-hidden={!open}
    >
      <div className="expand-panel-inner">{children}</div>
    </div>
  );
}
