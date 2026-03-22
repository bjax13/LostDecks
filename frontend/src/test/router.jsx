import { MemoryRouter } from "react-router-dom";
import { ROUTER_FUTURE_FLAGS } from "../routerFuture.js";

/** Use instead of raw `MemoryRouter` so tests match production router flags and stay warning-free. */
export function TestMemoryRouter({ children, ...props }) {
  return (
    <MemoryRouter {...props} future={ROUTER_FUTURE_FLAGS}>
      {children}
    </MemoryRouter>
  );
}
