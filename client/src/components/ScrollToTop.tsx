import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Reset window scroll on every client-side route change.
 * Wouter does not restore/reset scroll position, so without this a scrolled
 * page (e.g. Home) leaves the next route (Notices, Faculty, …) already
 * offset from the top.
 */
export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);

  return null;
}
