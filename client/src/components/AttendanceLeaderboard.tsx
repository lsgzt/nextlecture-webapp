import { Flame, Info, LoaderCircle, RefreshCw, Trophy, Users, WifiOff } from "lucide-react";
import type { AttendanceLeaderboard, AttendanceLeaderboardScope } from "@shared/attendance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SCOPE_OPTIONS: Array<{ value: AttendanceLeaderboardScope; label: string }> = [
  { value: "subsection", label: "Subsection-wise" },
  { value: "section", label: "Section-wise" },
  { value: "branch", label: "Branch-wise" },
  { value: "all", label: "All branches" },
];

function rankTone(rank: number) {
  if (rank === 1) return "bg-amber-100 text-amber-900 dark:bg-amber-950/55 dark:text-amber-100";
  if (rank === 2) return "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100";
  if (rank === 3) return "bg-orange-100 text-orange-900 dark:bg-orange-950/55 dark:text-orange-100";
  return "bg-muted text-muted-foreground";
}

type AttendanceLeaderboardProps = {
  scope: AttendanceLeaderboardScope;
  onScopeChange: (scope: AttendanceLeaderboardScope) => void;
  leaderboard: AttendanceLeaderboard | null;
  loading: boolean;
  error: string | null;
  retryBlocked: boolean;
  online: boolean;
  onRetry: () => void;
};

export function AttendanceLeaderboard({ scope, onScopeChange, leaderboard, loading, error, retryBlocked, online, onRetry }: AttendanceLeaderboardProps) {
  return <section className="mt-5 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-labelledby="attendance-leaderboard-title">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="eyebrow"><Trophy className="h-3.5 w-3.5" /> ATTENDANCE STREAKS</p>
        <h2 id="attendance-leaderboard-title" className="mt-2 font-display text-2xl font-semibold tracking-[-0.045em]">Leaderboard</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Compare eligible, same-day self-reported marks across your saved academic scope.</p>
      </div>
      <div className="w-full sm:w-52">
        <label htmlFor="leaderboard-scope" className="sr-only">Leaderboard scope</label>
        <Select value={scope} onValueChange={value => onScopeChange(value as AttendanceLeaderboardScope)}>
          <SelectTrigger id="leaderboard-scope" className="h-10 w-full bg-background font-semibold"><SelectValue /></SelectTrigger>
          <SelectContent>{SCOPE_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </div>

    <div className="mt-5 rounded-2xl border border-teal-100 bg-teal-50/65 px-4 py-3 text-sm leading-6 text-teal-950 dark:border-teal-900/70 dark:bg-teal-950/25 dark:text-teal-100">
      <Info className="mr-2 inline h-4 w-4 align-[-0.15rem] text-teal-700 dark:text-teal-300" />
      <strong>Self-reported attendance.</strong> Only marks entered on the same GNDEC calendar day count toward the leaderboard. This discourages retroactive manipulation but does not prove physical presence.
    </div>

    {!online && <div role="status" className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
      <span><strong>You are offline.</strong> Reconnect to load the latest leaderboard. Your private attendance controls are still available when connectivity returns.</span>
    </div>}

    {online && error && <div role="alert" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-6 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/25 dark:text-rose-100">
      <span>{error}</span>
      <button type="button" onClick={onRetry} disabled={retryBlocked || loading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-current px-3 py-1.5 text-xs font-bold transition hover:bg-white/60 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/10">
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />{retryBlocked ? "Retry shortly" : "Retry"}
      </button>
    </div>}

    {online && loading && <div className="mt-5 flex min-h-32 items-center justify-center gap-3 rounded-2xl bg-muted/45 text-sm font-medium text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin text-teal-700 dark:text-teal-300" /> Loading leaderboard…</div>}

    {online && !loading && leaderboard && <div className="mt-5 motion-safe:transition-opacity motion-safe:duration-200">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
        <p className="font-semibold">{leaderboard.scopeLabel}</p>
        <p className="inline-flex items-center gap-1.5 text-muted-foreground"><Users className="h-4 w-4" /> {leaderboard.participants} eligible participant{leaderboard.participants === 1 ? "" : "s"}</p>
      </div>
      {leaderboard.me && <div className="mt-4 grid gap-3 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-transparent p-4 dark:border-teal-900/70 dark:from-teal-950/35 sm:grid-cols-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-teal-800 dark:text-teal-200">Your rank</p><p className="mt-1 font-display text-2xl font-semibold">#{leaderboard.me.rank}</p></div>
        <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-teal-800 dark:text-teal-200">Current percentage</p><p className="mt-1 font-display text-2xl font-semibold">{leaderboard.me.percentage}%</p></div>
        <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-teal-800 dark:text-teal-200">Current streak</p><p className="mt-1 inline-flex items-center gap-1.5 font-display text-2xl font-semibold"><Flame className="h-5 w-5 text-orange-500" />{leaderboard.me.currentStreak} day{leaderboard.me.currentStreak === 1 ? "" : "s"}</p></div>
      </div>}
      {leaderboard.rows.length === 0 ? <div className="mt-4 rounded-2xl bg-muted/50 px-5 py-8 text-center"><Trophy className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-3 font-semibold">No eligible participants yet.</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Same-day attendance marks appear here after an eligible student starts tracking.</p></div> : <ol className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border">{leaderboard.rows.map(entry => <li key={`${entry.rank}-${entry.name}`} className="flex items-center gap-3 bg-background px-3 py-3.5 transition-colors duration-200 hover:bg-teal-50/45 dark:hover:bg-teal-950/20 sm:px-4"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${rankTone(entry.rank)}`}>#{entry.rank}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{entry.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{entry.markedTotal} marked lecture{entry.markedTotal === 1 ? "" : "s"}</p></div><div className="text-right"><p className="font-display text-xl font-semibold">{entry.percentage}%</p><p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-300"><Flame className="h-3.5 w-3.5" /> {entry.currentStreak}d streak</p></div></li>)}</ol>}
    </div>}
  </section>;
}
