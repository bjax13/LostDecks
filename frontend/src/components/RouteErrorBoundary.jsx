import { useLocation } from "react-router-dom";
import AppErrorBoundary from "./AppErrorBoundary.jsx";

/** Resets the error boundary when the route changes so navigation recovers the UI. */
export default function RouteErrorBoundary({ children }) {
  const location = useLocation();
  return <AppErrorBoundary key={location.pathname}>{children}</AppErrorBoundary>;
}
