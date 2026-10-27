import { BookOpenText, ClipboardCheck, DoorOpen, House, Megaphone } from "lucide-react";
import type { ComponentType } from "react";
import { Link, useLocation } from "wouter";

type DockItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  /** Route prefixes that mark this tab active (e.g. /campus covers /campus only). */
  match: string[];
};

const DOCK_ITEMS: DockItem[] = [
  { href: "/app", label: "Home", Icon: House, match: ["/app"] },
  { href: "/campus", label: "Notices", Icon: Megaphone, match: ["/campus"] },
  { href: "/vacant-rooms", label: "Rooms", Icon: DoorOpen, match: ["/vacant-rooms"] },
  { href: "/attendance", label: "Attendance", Icon: ClipboardCheck, match: ["/attendance", "/mark-attendance"] },
  { href: "/syllabus", label: "Syllabus", Icon: BookOpenText, match: ["/syllabus", "/papers"] },
];

/**
 * Floating bottom navigation dock shared by the core app pages — the web
 * counterpart of the Android app's PremiumBottomBar. Fixed dims, selection
 * expressed through color + the teal icon halo, never through layout shifts.
 */
export function AppBottomNav() {
  const [location] = useLocation();

  function isActive(item: DockItem) {
    return item.match.some(route => location === route || location.startsWith(`${route}/`));
  }

  return (
    <nav className="app-dock" aria-label="Main navigation">
      <div className="app-dock-inner">
        {DOCK_ITEMS.map(item => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="app-dock-link"
              data-active={active}
              aria-current={active ? "page" : undefined}
            >
              <span className="app-dock-icon">
                <item.Icon className="h-[1.15rem] w-[1.15rem]" />
              </span>
              <span className="app-dock-label">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
