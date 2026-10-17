import { MemoryRouter } from "react-router-dom";

/** Use instead of raw `MemoryRouter` so tests share one router wrapper. */
export function TestMemoryRouter({ children, ...props }) {
  return <MemoryRouter {...props}>{children}</MemoryRouter>;
}
