import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:-translate-y-0.5 hover:border-teal-600/30 hover:text-teal-700 active:scale-[0.97] dark:hover:text-teal-300"
      aria-label={isDark ? "Use light theme" : "Use dark theme"}
      title={isDark ? "Use light theme" : "Use dark theme"}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}
