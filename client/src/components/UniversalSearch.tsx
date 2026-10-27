import { CalendarDays, ClipboardCheck, DoorOpen, Download, FileText, House, Map, Megaphone, Search, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { FacultyAvatar } from "@/components/FacultyAvatar";
import { NoticeReader, compactNoticeTitle } from "@/components/NoticeReader";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FACULTY_MEMBERS,
  prettyFacultyName,
  splitContacts,
} from "@/lib/faculty-directory";
import { getLectureTypeStyle } from "@/lib/lecture-type-style";
import { trpc } from "@/lib/trpc";
import { DAY_ORDER, getTimeParts } from "@/lib/timetable-ui";
import type { CampusNotice } from "@shared/campus";
import { defaultSlotIndex, VACANT_ROOMS_DAYS } from "@shared/vacant-rooms";
import type { PreviousPaper, PreviousPaperSession } from "@shared/previous-papers";
import type { Lecture, TimetableResponse } from "@shared/timetable";

const LOCAL_TIMETABLE_KEY = "nextlecture:last-timetable";
const SELECTED_GROUP_KEY = "nextlecture:selected-group";

function safelyReadLocalTimetable(): TimetableResponse | null {
  try {
    const raw = localStorage.getItem(LOCAL_TIMETABLE_KEY);
    return raw ? (JSON.parse(raw) as TimetableResponse) : null;
  } catch {
    return null;
  }
}

function matches(query: string, ...keywords: Array<string | null | undefined>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  return keywords.some(keyword => Boolean(keyword) && `${keyword}`.toLowerCase().includes(needle));
}

function formatRange(startTime: string, endTime: string) {
  const start = getTimeParts(startTime);
  const end = getTimeParts(endTime);
  return `${start.clock} ${start.meridiem} – ${end.clock} ${end.meridiem}`;
}

const PAGES = [
  { href: "/app", label: "Home · Timetable", Icon: House },
  { href: "/faculty", label: "Faculty members", Icon: UsersRound },
  { href: "/campus", label: "Notices & holidays", Icon: Megaphone },
  { href: "/vacant-rooms", label: "Vacant rooms", Icon: DoorOpen },
  { href: "/attendance", label: "Attendance", Icon: ClipboardCheck },
  { href: "/syllabus", label: "Syllabus AI", Icon: FileText },
  { href: "/papers", label: "Previous year papers", Icon: FileText },
  { href: "/download", label: "Download Android app", Icon: Download },
];

/**
 * Universal search: one button (plus Cmd/Ctrl-K or "/") that reaches lectures,
 * timetable groups, vacant rooms, notices, holidays, papers and pages. Same
 * spirit as the Android app's search entries, built for the web.
 */
export function UniversalSearch({
  timetable,
  className = "",
}: {
  timetable?: TimetableResponse | null;
  className?: string;
}) {
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedNotice, setSelectedNotice] = useState<CampusNotice | null>(null);

  const effectiveTimetable = useMemo(() => timetable ?? safelyReadLocalTimetable(), [timetable]);

  const noticesQuery = trpc.campus.notices.useQuery(undefined, { enabled: open, staleTime: 60_000, retry: 1 });
  const holidaysQuery = trpc.campus.holidays.useQuery(undefined, { enabled: open, staleTime: 10 * 60_000, retry: 1 });
  const groupsQuery = trpc.timetable.groups.useQuery(undefined, { enabled: open, staleTime: 60_000, retry: 1 });
  const roomsQuery = trpc.vacantRooms.data.useQuery(undefined, { enabled: open, staleTime: 10 * 60_000, retry: 1 });
  const sessionsQuery = trpc.previousPapers.sessions.useQuery(undefined, { enabled: open, staleTime: Infinity, retry: 1 });

  const latestSession = useMemo(() => {
    const sessions = sessionsQuery.data ?? [];
    return sessions.filter(session => !session.makeup).at(-1) ?? sessions.at(-1) ?? null;
  }, [sessionsQuery.data]);

  const papersQuery = trpc.previousPapers.papers.useQuery({ sessionId: latestSession?.id ?? "" }, { enabled: open && Boolean(latestSession), staleTime: 10 * 60_000, retry: 1 });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, select, [contenteditable='true']") != null;
      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(current => !current);
        return;
      }
      if (event.key === "/" && !typing) {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  function go(href: string) {
    close();
    navigate(href);
  }

  const lectures = useMemo(() => {
    if (!query.trim() || !effectiveTimetable) return [];
    return effectiveTimetable.timetable.lectures
      .filter(lecture => matches(query, lecture.subject, lecture.teacher, lecture.venue, lecture.lectureType, lecture.day))
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime))
      .slice(0, 7);
  }, [query, effectiveTimetable]);

  // Faculty directory search — static bundled data, instant like the Android app.
  const faculty = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return FACULTY_MEMBERS.filter(member =>
      matches(
        trimmed,
        member.name,
        prettyFacultyName(member.name),
        member.designation,
        member.department,
        ...splitContacts(member.email),
        ...splitContacts(member.phone_mobile),
        ...splitContacts(member.phone_office)
      )
    ).slice(0, 6);
  }, [query]);

  const groups = useMemo(() => {
    if (!query.trim()) return [];
    return (groupsQuery.data?.groups ?? [])
      .filter(group => matches(query, group.code, group.sourceYear))
      .slice(0, 6);
  }, [query, groupsQuery.data]);

  const rooms = useMemo(() => {
    if (!query.trim()) return [];
    const data = roomsQuery.data;
    if (!data) return [];
    const now = new Date();
    const dayIndex = (now.getDay() + 6) % 7;
    const slotIndex = defaultSlotIndex(data.slotStarts, now);
    const isWeekendDay = dayIndex >= VACANT_ROOMS_DAYS.length;
    return data.rooms
      .filter(room => matches(query, room.name))
      .slice(0, 6)
      .map(room => {
        const cell = isWeekendDay ? null : room.occupancy[dayIndex]?.[slotIndex] ?? null;
        const status = cell == null ? "Availability unknown" : cell.busy ? "Busy right now" : "Free right now";
        return { key: room.key, name: room.name, status };
      });
  }, [query, roomsQuery.data]);

  const notices = useMemo(() => {
    if (!query.trim()) return [];
    return (noticesQuery.data?.notices ?? [])
      .filter(notice => matches(query, notice.title, notice.author, notice.source))
      .slice(0, 5);
  }, [query, noticesQuery.data]);

  const holidays = useMemo(() => {
    if (!query.trim()) return [];
    return (holidaysQuery.data?.holidays ?? [])
      .filter(holiday => matches(query, holiday.name, holiday.category, holiday.displayDate, holiday.weekday))
      .slice(0, 5);
  }, [query, holidaysQuery.data]);

  const papers = useMemo<{ papersList: PreviousPaper[]; sessionMatches: PreviousPaperSession[] }>(() => {
    if (!query.trim()) return { papersList: [], sessionMatches: [] };
    const papersList = (papersQuery.data?.papers ?? [])
      .filter(paper => matches(query, paper.name, latestSession?.label))
      .slice(0, 6);
    const sessionMatches = (sessionsQuery.data ?? [])
      .filter(session => matches(query, session.label, String(session.year), session.term))
      .slice(0, 4);
    return { papersList, sessionMatches };
  }, [query, papersQuery.data, sessionsQuery.data, latestSession]);

  const hasResults =
    PAGES.some(page => matches(query, page.label)) ||
    lectures.length > 0 ||
    faculty.length > 0 ||
    groups.length > 0 ||
    rooms.length > 0 ||
    notices.length > 0 ||
    holidays.length > 0 ||
    papers.papersList.length > 0 ||
    papers.sessionMatches.length > 0;

  function chooseGroup(code: string) {
    localStorage.setItem(SELECTED_GROUP_KEY, code);
    go(`/app?group=${encodeURIComponent(code)}`);
  }

  function openNotice(notice: CampusNotice) {
    close();
    setSelectedNotice(notice);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`app-header-button ${className}`}
        aria-label="Search everything (press / or Control-K)"
        title="Search everything (press / or Control-K)"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="ml-1 hidden rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.6rem] font-medium text-muted-foreground lg:inline">/</kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={next => (next ? setOpen(true) : close())}
        title="Universal search"
        description="Search lectures, rooms, notices, holidays, papers and pages"
        className="nl-search sm:max-w-xl"
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search lectures, rooms, notices, holidays…"
        />
        <CommandList className="max-h-[min(24rem,60vh)]">
          {!hasResults && <CommandEmpty>Nothing matches “{query.trim()}”.</CommandEmpty>}

          {lectures.length > 0 && (
            <CommandGroup heading="Lectures">
              {lectures.map(lecture => (
                <LectureResult key={`${lecture.day}-${lecture.startTime}-${lecture.subject}`} lecture={lecture} onSelect={() => go(`/app?day=${lecture.day}`)} />
              ))}
            </CommandGroup>
          )}

          {faculty.length > 0 && (
            <CommandGroup heading="Faculty">
              {faculty.map(member => (
                <CommandItem
                  key={member.profile_id}
                  value={`${member.name} ${member.designation} ${member.department}`}
                  onSelect={() => go(`/faculty?id=${encodeURIComponent(member.profile_id)}`)}
                >
                  <FacultyAvatar name={member.name} imageUrl={member.image_url} size="h-6 w-6" className="!text-[0.55rem]" />
                  <span className="min-w-0 max-w-[55%] truncate font-semibold">{prettyFacultyName(member.name)}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:inline">{member.department}</span>
                  <span className="ml-auto shrink-0 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{member.designation || "Faculty"}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {groups.length > 0 && (
            <CommandGroup heading="Timetable groups">
              {groups.map(group => (
                <CommandItem key={group.code} value={`${group.code} ${group.sourceYear}`} onSelect={() => chooseGroup(group.code)}>
                  <House className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-semibold">{group.code}</span>
                  <span className="text-xs text-muted-foreground">{group.sourceYear.replace(/^Year\s+/i, "")}</span>
                  <span className="ml-auto text-[0.65rem] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">Switch</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {rooms.length > 0 && (
            <CommandGroup heading="Vacant rooms">
              {rooms.map(room => (
                <CommandItem key={room.key} value={room.name} onSelect={() => go(`/vacant-rooms?room=${encodeURIComponent(room.key)}`)}>
                  <DoorOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 truncate font-semibold">{room.name}</span>
                  <span className={`ml-auto shrink-0 text-xs font-bold ${room.status === "Free right now" ? "text-teal-700 dark:text-teal-300" : "text-muted-foreground"}`}>{room.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {notices.length > 0 && (
            <CommandGroup heading="Notices">
              {notices.map(notice => (
                <CommandItem key={notice.id} value={notice.title} onSelect={() => openNotice(notice)}>
                  <Megaphone className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                  <span className="min-w-0 truncate font-medium">{compactNoticeTitle(notice.title, 60)}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{notice.displayDate}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {holidays.length > 0 && (
            <CommandGroup heading="Holidays">
              {holidays.map(holiday => (
                <CommandItem key={holiday.id} value={`${holiday.name} ${holiday.displayDate}`} onSelect={() => go("/campus?tab=holidays")}>
                  <CalendarDays className="h-4 w-4 text-teal-600" aria-hidden="true" />
                  <span className="min-w-0 truncate font-semibold">{holiday.name}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">{holiday.displayDate}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {(papers.papersList.length > 0 || papers.sessionMatches.length > 0) && (
            <CommandGroup heading="Previous papers">
              {papers.sessionMatches.map(session => (
                <CommandItem key={session.id} value={session.label} onSelect={() => go(`/papers?session=${encodeURIComponent(session.id)}`)}>
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-semibold">{session.label}</span>
                  <span className="ml-auto text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">Session</span>
                </CommandItem>
              ))}
              {papers.papersList.map(paper => (
                <CommandItem key={paper.id} value={paper.name} onSelect={() => window.open(paper.viewUrl, "_blank", "noreferrer")}>
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 truncate font-medium">{paper.name}</span>
                  <span className="ml-auto shrink-0 text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{latestSession?.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Pages">
            {PAGES.filter(page => matches(query, page.label) || page.href === "/app").map(page => (
              <CommandItem key={page.href} value={page.label} onSelect={() => go(page.href)}>
                <page.Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <span className="font-semibold">{page.label}</span>
                <Map className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {selectedNotice && <NoticeReader notice={selectedNotice} onClose={() => setSelectedNotice(null)} />}
    </>
  );
}

function LectureResult({ lecture, onSelect }: { lecture: Lecture; onSelect: () => void }) {
  const style = getLectureTypeStyle(lecture.lectureType);
  return (
    <CommandItem value={`${lecture.subject} ${lecture.teacher ?? ""} ${lecture.venue ?? ""} ${lecture.day}`} onSelect={onSelect}>
      <span className={`nl-type-dot mr-1 ${style.dot}`} data-type-dot="true" aria-hidden="true" />
      <span className="min-w-0 max-w-[55%] truncate font-semibold">{lecture.subject}</span>
      {lecture.venue && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{lecture.venue}</span>}
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        {lecture.day.slice(0, 3)} · {formatRange(lecture.startTime, lecture.endTime)}
      </span>
    </CommandItem>
  );
}
