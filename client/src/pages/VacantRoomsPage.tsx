import {
  defaultDayIndex,
  defaultSlotIndex,
  formatSlotRange,
  isCurrentSlot,
  isToday,
  roomNameMatches,
  rootLabel,
  type GlobalRoomData,
  type MergedRoom,
  type RoomCell,
} from "@shared/vacant-rooms";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CloudOff,
  LoaderCircle,
  DoorOpen,
  RefreshCw,
  Search,
  UsersRound,
  BookOpen,
  UserRound,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { trpc } from "@/lib/trpc";
import { BRAND_LOGO_URL } from "@shared/config";

function cellOf(room: MergedRoom, dayIndex: number, slotIndex: number): RoomCell | null | undefined {
  return room.occupancy[dayIndex]?.[slotIndex];
}

function freshnessText(fetchedAt: number, now: number) {
  const mins = Math.max(0, Math.round((now - fetchedAt) / 60_000));
  if (mins < 1) return "updated just now";
  if (mins < 60) return `updated ${mins} min ago`;
  const hours = Math.round(mins / 60);
  return `updated ${hours}h ago`;
}

const easeOut = [0.22, 1, 0.36, 1] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, delay: i * 0.05, ease: easeOut },
  }),
};

const listContainer = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.035, delayChildren: 0.04 },
  },
};

const listItem = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.28, ease: easeOut },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.98,
    transition: { duration: 0.18, ease: "easeIn" as const },
  },
};

export default function VacantRoomsPage() {
  const [dayIndex, setDayIndex] = useState(() => defaultDayIndex());
  const [slotIndex, setSlotIndex] = useState(-1);
  const [vacantOnly, setVacantOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  const dataQuery = trpc.vacantRooms.data.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const refreshMutation = trpc.vacantRooms.refresh.useMutation({
    onSuccess: () => dataQuery.refetch(),
  });

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  const data = dataQuery.data as GlobalRoomData | undefined;

  useEffect(() => {
    if (!data || slotIndex >= 0) return;
    setSlotIndex(defaultSlotIndex(data.slotStarts, now));
  }, [data, slotIndex, now]);

  const safeDay = data ? Math.min(Math.max(dayIndex, 0), Math.max(data.days.length - 1, 0)) : 0;
  const safeSlot = data ? Math.min(Math.max(slotIndex < 0 ? 0 : slotIndex, 0), Math.max(data.slotStarts.length - 1, 0)) : 0;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayIsTeachingDay = data ? isToday(safeDay, now) : false;
  const selectedSlotStart = data?.slotStarts[safeSlot] ?? 0;
  const selectedSlotIsNow = todayIsTeachingDay && isCurrentSlot(selectedSlotStart, nowMinutes);

  const freeCount = useMemo(() => {
    if (!data) return 0;
    return data.rooms.filter(r => cellOf(r, safeDay, safeSlot)?.busy === false).length;
  }, [data, safeDay, safeSlot]);

  const noDataCount = useMemo(() => {
    if (!data) return 0;
    return data.rooms.filter(r => cellOf(r, safeDay, safeSlot) == null).length;
  }, [data, safeDay, safeSlot]);

  const filteredRooms = useMemo(() => {
    if (!data) return [];
    const trimmed = query.trim();
    return data.rooms.filter(room => {
      if (trimmed && !roomNameMatches(room.name, trimmed)) return false;
      if (vacantOnly && cellOf(room, safeDay, safeSlot)?.busy !== false) return false;
      return true;
    });
  }, [data, query, vacantOnly, safeDay, safeSlot]);

  const loading = dataQuery.isLoading && !data;
  const error = dataQuery.isError && !data;
  const refreshing = dataQuery.isFetching || refreshMutation.isPending;

  return (
    <div className="min-h-screen bg-[#f7f8f6] text-foreground dark:bg-[#101917]">
      <header className="app-topbar">
        <div className="container flex h-17 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-teal-700 dark:hover:text-teal-300"
              aria-label="Back to timetable"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <img
              src={BRAND_LOGO_URL}
              alt="NextLecture"
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm shadow-teal-950/25"
            />
            <div>
              <p className="font-display text-lg font-semibold tracking-[-0.04em]">Vacant rooms</p>
              <p className="text-[0.65rem] font-semibold tracking-[0.13em] text-teal-700 dark:text-teal-300">
                GNDEC ROOM TIMETABLES
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshing}
              className="grid h-9 w-9 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-60 dark:hover:border-teal-900 dark:hover:bg-teal-950/35 dark:hover:text-teal-300"
              aria-label="Refresh"
            >
              {refreshing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container max-w-3xl space-y-5 pb-16 pt-7 sm:pt-10">
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: easeOut }}
              className="rounded-3xl border border-border bg-card p-10 text-center"
            >
              <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-teal-700" />
              <p className="mt-4 font-medium">Loading department room timetables…</p>
              <p className="mt-1 text-sm text-muted-foreground">Checking every published GNDEC room export.</p>
            </motion.div>
          )}

          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: easeOut }}
              className="rounded-3xl border border-amber-200 bg-amber-50 p-7 dark:border-amber-900/60 dark:bg-amber-950/25"
            >
              <AlertCircle className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              <h1 className="mt-4 font-display text-2xl font-semibold tracking-[-0.045em]">Couldn&apos;t load room timetables</h1>
              <p className="mt-2 leading-7 text-muted-foreground">
                {(dataQuery.error as Error | null)?.message ?? "Please check your connection and try again."}
              </p>
              <button
                type="button"
                onClick={() => dataQuery.refetch()}
                className="mt-5 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 active:scale-[0.97]"
              >
                Try again
              </button>
            </motion.div>
          )}

          {data && (
            <motion.div
              key="ready"
              initial="hidden"
              animate="show"
              className="space-y-5"
            >
              <motion.section
                custom={0}
                variants={fadeUp}
                className="rounded-[1.75rem] border border-teal-200/80 bg-gradient-to-br from-teal-700 to-teal-900 p-5 text-white shadow-lg shadow-teal-950/15 sm:p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-[0.68rem] font-bold tracking-[0.14em]">
                    {selectedSlotIsNow ? "RIGHT NOW" : "AT A GLANCE"}
                  </span>
                  <span className="text-sm font-medium text-teal-100">
                    {data.days[safeDay]} · {formatSlotRange(selectedSlotStart)}
                  </span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${safeDay}-${safeSlot}-${freeCount}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, ease: easeOut }}
                    className="mt-5 font-display text-5xl font-semibold tracking-[-0.05em] tabular-nums"
                  >
                    {freeCount}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-1 text-lg font-medium text-teal-50">
                  vacant of {data.rooms.length} rooms
                  {noDataCount > 0 ? ` · ${noDataCount} unknown` : ""}
                </p>
                {!todayIsTeachingDay && (
                  <p className="mt-3 text-sm text-teal-100/90">Weekend — showing the selected weekday schedule.</p>
                )}
              </motion.section>

              <motion.section custom={1} variants={fadeUp}>
                <p className="mb-2 text-xs font-bold tracking-[0.14em] text-muted-foreground">DAY</p>
                <div className="flex flex-wrap gap-2">
                  {data.days.map((day, i) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setExpandedKey(null);
                        setDayIndex(i);
                      }}
                      className={`min-h-9 rounded-full px-3.5 text-sm font-semibold transition-all duration-200 ${
                        i === safeDay
                          ? "bg-teal-700 text-white shadow-sm shadow-teal-900/20 scale-[1.02]"
                          : "border border-border bg-card text-muted-foreground hover:text-teal-700 hover:border-teal-300"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </motion.section>

              <motion.section custom={2} variants={fadeUp}>
                <p className="mb-2 text-xs font-bold tracking-[0.14em] text-muted-foreground">TIME</p>
                <div className="flex flex-wrap gap-2">
                  {data.slotStarts.map((slot, i) => {
                    const isNowChip = todayIsTeachingDay && isCurrentSlot(slot, nowMinutes);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => {
                          setExpandedKey(null);
                          setSlotIndex(i);
                        }}
                        className={`relative min-h-9 rounded-full px-3.5 text-sm font-semibold transition-all duration-200 ${
                          i === safeSlot
                            ? "bg-teal-700 text-white shadow-sm shadow-teal-900/20 scale-[1.02]"
                            : "border border-border bg-card text-muted-foreground hover:text-teal-700 hover:border-teal-300"
                        }`}
                      >
                        {formatSlotRange(slot)}
                        {isNowChip && (
                          <span className="ml-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300 align-middle" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.section>

              <motion.section custom={3} variants={fadeUp} className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => {
                    setVacantOnly(v => !v);
                    setExpandedKey(null);
                  }}
                  className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.97] ${
                    vacantOnly
                      ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950/40 dark:text-teal-200"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Vacant only
                </button>
                <label className="relative block min-w-0 flex-1">
                  <span className="sr-only">Search rooms</span>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search rooms, e.g. F119 or lab"
                    className="h-11 w-full rounded-xl border border-input bg-background pl-10 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
                  />
                </label>
              </motion.section>

              <AnimatePresence>
                {data.incompleteRoots.length > 0 && (
                  <motion.div
                    key="incomplete"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100">
                      <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Not checked: {data.incompleteRoots.map(rootLabel).join(", ")} — the list may be incomplete
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.p custom={4} variants={fadeUp} className="text-sm font-semibold text-muted-foreground">
                {filteredRooms.length} of {data.rooms.length} rooms
              </motion.p>

              <motion.div
                key={`${safeDay}-${safeSlot}-${vacantOnly}-${query}`}
                variants={listContainer}
                initial="hidden"
                animate="show"
                className="space-y-2.5"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {filteredRooms.map(room => {
                    const cell = cellOf(room, safeDay, safeSlot);
                    const free = cell?.busy === false;
                    const unknown = cell == null;
                    const expanded = expandedKey === room.key;
                    return (
                      <motion.article
                        key={room.key}
                        layout
                        variants={listItem}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        whileHover={{ y: -1 }}
                        transition={{ layout: { duration: 0.22, ease: easeOut } }}
                        className={`rounded-2xl border bg-card transition-colors ${
                          free
                            ? "border-teal-200 dark:border-teal-900"
                            : unknown
                              ? "border-border opacity-70"
                              : "border-border"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedKey(expanded ? null : room.key)}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:scale-[0.995]"
                        >
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors duration-200 ${
                              free
                                ? "bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <DoorOpen className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{room.name}</p>
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {free ? "Vacant" : unknown ? "No data for this slot" : cell?.subject || "Occupied"}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] font-bold tracking-wide transition-colors duration-200 ${
                              free
                                ? "bg-teal-700 text-white"
                                : unknown
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-stone-200 text-stone-700 dark:bg-white/10 dark:text-stone-200"
                            }`}
                          >
                            {free ? "FREE" : unknown ? "—" : "BUSY"}
                          </span>
                          <motion.span
                            animate={{ rotate: expanded ? 90 : 0 }}
                            transition={{ duration: 0.2, ease: easeOut }}
                            className="inline-flex shrink-0 text-muted-foreground"
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </motion.span>
                        </button>
                        <AnimatePresence initial={false}>
                          {expanded && cell && cell.busy && (
                            <motion.div
                              key="details"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.24, ease: easeOut }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
                                {cell.subject && (
                                  <p className="flex items-center gap-2">
                                    <BookOpen className="h-3.5 w-3.5 text-teal-600" />
                                    {cell.subject}
                                    {cell.activity ? ` (${cell.activity})` : ""}
                                  </p>
                                )}
                                {cell.teacher && (
                                  <p className="flex items-center gap-2">
                                    <UserRound className="h-3.5 w-3.5 text-teal-600" />
                                    {cell.teacher}
                                  </p>
                                )}
                                {cell.studentsSet && (
                                  <p className="flex items-center gap-2">
                                    <UsersRound className="h-3.5 w-3.5 text-teal-600" />
                                    {cell.studentsSet}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>

                {filteredRooms.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-10 text-center"
                  >
                    <p className="font-semibold">No rooms match</p>
                    <p className="mt-1 text-sm text-muted-foreground">Try another day, slot, or search term.</p>
                  </motion.div>
                )}
              </motion.div>

              <motion.p custom={5} variants={fadeUp} className="pt-2 text-center text-xs text-muted-foreground">
                From {data.sources.length} official GNDEC timetables · {freshnessText(data.fetchedAtMillis, now.getTime())}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
