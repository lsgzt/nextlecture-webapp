import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  ArrowLeft,
  Building2,
  CalendarCheck,
  ChevronRight,
  Clock3,
  ExternalLink,
  Mail,
  Phone,
  Pin,
  Search,
  Sun,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppBottomNav } from "@/components/AppBottomNav";
import { FacultyAvatar } from "@/components/FacultyAvatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UniversalSearch } from "@/components/UniversalSearch";
import type { FacultyMember } from "@/data/faculty-directory";
import {
  FACULTY_DEPARTMENT_COUNTS,
  FACULTY_DEPARTMENTS,
  FACULTY_MEMBERS,
  facultyByProfileId,
  facultyDialableOfficeNumbers,
  facultyEmails,
  facultyMobileNumbers,
  facultyOfficeNumbers,
  facultyPinRank,
  isDialablePhone,
  isIntercom,
  isPinnedFaculty,
  prettyFacultyName,
  shortDepartment,
  splitContacts,
} from "@/lib/faculty-directory";
import {
  deriveFacultySchedules,
  facultyDayIndex,
  facultyLiveStatus,
  formatMinutes,
  type FacultySlot,
} from "@/lib/faculty-timetable";
import { getLectureTypeStyle } from "@/lib/lecture-type-style";
import { trpc } from "@/lib/trpc";
import { BRAND_LOGO_URL } from "@shared/config";
import { formatSlotRange, VACANT_ROOMS_DAYS, type GlobalRoomData } from "@shared/vacant-rooms";

const DAY_LABELS = VACANT_ROOMS_DAYS;

function memberSubtitle(member: FacultyMember): string {
  const parts = [member.designation, member.email ? facultyEmails(member)[0] : null].filter(Boolean);
  return parts.join(" · ") || "Faculty";
}

/* ------------------------------------------------------------------ */
/* List — every teacher in the bundled college directory.              */
/* ------------------------------------------------------------------ */

function DeptChip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`nl-enter inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition ${
        selected
          ? "border-teal-700 bg-teal-700/10 text-teal-800 dark:border-teal-500 dark:text-teal-300"
          : "border-border bg-card text-foreground hover:border-teal-700/30"
      }`}
    >
      {label}
      <span className={selected ? "text-teal-700 dark:text-teal-400" : "text-muted-foreground"}>{count}</span>
    </button>
  );
}

function FacultyRow({ member, pinned, onOpen }: { member: FacultyMember; pinned?: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="nl-enter group flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition hover:border-teal-700/25 hover:shadow-sm"
    >
      <FacultyAvatar name={member.name} imageUrl={member.image_url} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-foreground">{prettyFacultyName(member.name)}</span>
        <span className="mt-0.5 block truncate text-sm text-muted-foreground">{memberSubtitle(member)}</span>
      </span>
      {pinned && (
        <Pin
          className="h-3.5 w-3.5 shrink-0 fill-teal-600/15 text-teal-600 dark:fill-teal-400/15 dark:text-teal-400"
          aria-label="Pinned to the top of the list"
        />
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Detail — contact details, live status and the weekly timetable.     */
/* ------------------------------------------------------------------ */

function ContactRow({
  icon,
  label,
  value,
  href,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string | null;
  note?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.63rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} className="mt-0.5 block break-words text-sm font-semibold text-teal-700 underline-offset-2 hover:underline dark:text-teal-300">
            {value}
          </a>
        ) : (
          <p className="mt-0.5 break-words text-sm font-semibold text-foreground">{value}</p>
        )}
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => toast.success(`Copied ${label.toLowerCase()}`));
        }}
        className="min-h-9 shrink-0 rounded-lg border border-border bg-background px-3 text-[0.65rem] font-bold text-muted-foreground transition hover:text-teal-700 dark:hover:text-teal-300"
      >
        Copy
      </button>
    </div>
  );
}

function ScheduleSlotRow({ slot, now }: { slot: FacultySlot; now: Date }) {
  const endMinutes = slot.startMinutes + 60;
  const todayIndex = facultyDayIndex(now);
  const isNow = todayIndex === slot.dayIndex && now.getHours() * 60 + now.getMinutes() >= slot.startMinutes && now.getHours() * 60 + now.getMinutes() < endMinutes;
  const typeStyle = getLectureTypeStyle(slot.activity);
  return (
    <article
      className={`nl-enter relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-card px-4 py-3 pl-[1.1rem] ${
        isNow ? "border-teal-600 bg-teal-50/75 dark:border-teal-700 dark:bg-teal-950/35" : "border-border"
      }`}
    >
      <span className={`absolute inset-y-2.5 left-0 w-[3px] rounded-full ${typeStyle.edge}`} aria-hidden="true" />
      <p className="w-[4.6rem] shrink-0 text-xs font-bold tabular-nums text-muted-foreground">{formatSlotRange(slot.startMinutes).replace(" – ", "–")}</p>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-foreground">{slot.subject || "Scheduled class"}</p>
          {typeStyle.label && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-bold tracking-wide ${typeStyle.chipOnCard}`}>{typeStyle.label}</span>}
        </div>
        {slot.room && <p className="mt-0.5 truncate text-xs text-muted-foreground">{slot.room}</p>}
      </div>
      {isNow && <span className="shrink-0 rounded-full bg-teal-700 px-2 py-0.5 text-[0.6rem] font-bold tracking-wide text-white">NOW</span>}
    </article>
  );
}

function StatusPillText({ status }: { status: ReturnType<typeof facultyLiveStatus> }) {
  if (status.kind === "busy") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[0.65rem] font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
        Teaching now{status.until ? ` · free by ${status.until}` : ""}
      </span>
    );
  }
  if (status.kind === "free") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-[0.65rem] font-bold text-green-700 dark:bg-green-950/40 dark:text-green-300">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
        Free right now{status.until ? ` · until ${status.until}` : ""}
      </span>
    );
  }
  if (status.kind === "weekend") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[0.65rem] font-bold text-muted-foreground">
        <Sun className="h-3 w-3" aria-hidden="true" />
        Weekend — no scheduled classes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[0.65rem] font-bold text-muted-foreground">
      <Clock3 className="h-3 w-3" aria-hidden="true" />
      Timetable not available
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function FacultyMembersPage() {
  const [, navigate] = useLocation();
  const [now, setNow] = useState(() => new Date());
  const [filterText, setFilterText] = useState("");
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"today" | "week">("today");
  const [photoOpen, setPhotoOpen] = useState(false);
  // ?id= opens the detail view — reactive to deep links, wouter navigation
  // AND the browser's back/forward buttons (wouter's useSearch subscribes
  // to pushState/popstate, unlike useLocation which ignores search params).
  const search = useSearch();
  const selectedId = useMemo(() => new URLSearchParams(search).get("id"), [search]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(tick);
  }, []);

  // Reset the schedule tab + photo viewer when opening another teacher.
  useEffect(() => {
    setDetailTab("today");
    setPhotoOpen(false);
  }, [selectedId]);

  const roomsQuery = trpc.vacantRooms.data.useQuery(undefined, {
    enabled: Boolean(selectedId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const roomData = roomsQuery.data as GlobalRoomData | undefined;

  // The matcher runs once per fresh room-occupancy fetch, never per render.
  const schedules = useMemo(() => (roomData ? deriveFacultySchedules(roomData) : null), [roomData]);

  const visible = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    const matches = FACULTY_MEMBERS.filter(member => {
      if (selectedDept && member.department !== selectedDept) return false;
      if (!needle) return true;
      return (
        member.name.toLowerCase().includes(needle) ||
        (member.also_published_as ?? []).some(alias => alias.toLowerCase().includes(needle)) ||
        member.department.toLowerCase().includes(needle) ||
        member.designation.toLowerCase().includes(needle) ||
        splitContacts(member.email).some(email => email.toLowerCase().includes(needle)) ||
        splitContacts(member.phone_mobile).some(number => number.includes(needle)) ||
        splitContacts(member.phone_office).some(number => number.includes(needle))
      );
    });
    // Pinned teachers (the ones students reach for most) float to the very
    // top; sort() is stable so everyone else keeps the bundled department +
    // name order.
    return matches.sort((a, b) => facultyPinRank(a) - facultyPinRank(b));
  }, [filterText, selectedDept]);

  const grouped = useMemo(() => {
    if (selectedDept) return [{ dept: selectedDept, members: visible }];
    // Group by department regardless of position (not just consecutive runs)
    // so a pinned teacher can lead her department's group without splitting
    // it in two. Map preserves first-appearance order, so the department that
    // owns the pinned teacher opens the list.
    const byDept = new Map<string, FacultyMember[]>();
    for (const member of visible) {
      const bucket = byDept.get(member.department);
      if (bucket) bucket.push(member);
      else byDept.set(member.department, [member]);
    }
    return Array.from(byDept, ([dept, members]) => ({ dept, members }));
  }, [visible, selectedDept]);

  const member = selectedId ? facultyByProfileId(selectedId) : null;

  function openMember(profileId: string) {
    navigate(`/faculty?id=${encodeURIComponent(profileId)}`);
    window.scrollTo({ top: 0 });
  }

  function backToList() {
    navigate("/faculty");
    window.scrollTo({ top: 0 });
  }

  const slots = member ? (schedules?.get(member.profile_id) ?? null) : null;
  const liveStatus = member ? facultyLiveStatus(slots ?? undefined, roomData?.slotStarts ?? [], now) : null;
  const todayIndex = facultyDayIndex(now);
  const todaySlots = slots && todayIndex !== null ? slots.filter(slot => slot.dayIndex === todayIndex) : [];

  return (
    <div className="min-h-screen bg-[#f7f8f6] text-foreground dark:bg-[#101917]">
      <header className="app-topbar">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="NextLecture home">
              <img src={BRAND_LOGO_URL} alt="NextLecture" width={32} height={32} className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm shadow-teal-950/25" />
            </Link>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold tracking-[-0.04em]">{member ? "Faculty details" : "Faculty members"}</p>
              <p className="text-[0.65rem] font-semibold tracking-[0.13em] text-teal-700 dark:text-teal-300">GNDEC COLLEGE DIRECTORY</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <UniversalSearch />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container max-w-5xl pt-5 app-bottom-clearance">
        {!member && (
          <section>
            <p className="eyebrow">GNDEC COLLEGE DIRECTORY</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">Faculty members</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {FACULTY_MEMBERS.length} teachers · {FACULTY_DEPARTMENTS.length} departments — profiles, contacts and live timetables.
            </p>

            <div className="relative mt-5">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                value={filterText}
                onChange={event => setFilterText(event.target.value)}
                placeholder="Filter by name, email, department or phone"
                className="h-12 w-full rounded-2xl border border-input bg-card pl-10 pr-10 text-sm outline-none transition placeholder:text-muted-foreground focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
                type="search"
              />
              {filterText && (
                <button
                  type="button"
                  onClick={() => setFilterText("")}
                  aria-label="Clear filter"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Department filter">
              <DeptChip label="All" count={FACULTY_MEMBERS.length} selected={selectedDept === null} onClick={() => setSelectedDept(null)} />
              {FACULTY_DEPARTMENTS.map(dept => (
                <DeptChip
                  key={dept}
                  label={shortDepartment(dept)}
                  count={FACULTY_DEPARTMENT_COUNTS[dept] ?? 0}
                  selected={selectedDept === dept}
                  onClick={() => setSelectedDept(selectedDept === dept ? null : dept)}
                />
              ))}
            </div>

            <div className="mt-5 space-y-5 pb-6">
              {grouped.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card px-5 py-8 text-center">
                  <p className="font-semibold">No teachers match</p>
                  <p className="mt-1 text-sm text-muted-foreground">Try a shorter name, an email, or pick a different department.</p>
                </div>
              ) : (
                grouped.map(group => (
                  <section key={group.dept} aria-label={group.dept}>
                    {!selectedDept && (
                      <h2 className="mb-2 px-1 text-[0.66rem] font-bold tracking-[0.12em] text-teal-700 dark:text-teal-300">
                        {group.dept.toUpperCase()} · {group.members.length} {group.members.length === 1 ? "TEACHER" : "TEACHERS"}
                      </h2>
                    )}
                    {/* grid-cols-1 = minmax(0,1fr): lets truncated rows shrink below
                        their max-content width instead of forcing the page wide. */}
                    <div className="grid grid-cols-1 gap-2">
                      {group.members.map(item => (
                        <FacultyRow key={item.profile_id} member={item} pinned={isPinnedFaculty(item)} onOpen={() => openMember(item.profile_id)} />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          </section>
        )}

        {member && (
          <section>
            <button
              type="button"
              onClick={backToList}
              className="app-header-button mb-4"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to directory
            </button>

            {/* Identity card */}
            <div className="nl-enter flex flex-col gap-4 rounded-[1.5rem] border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
              <FacultyAvatar
                name={member.name}
                imageUrl={member.image_url}
                size="h-20 w-20"
                className="text-base"
                onPhotoClick={member.image_url ? () => setPhotoOpen(true) : undefined}
              />
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-2xl font-semibold tracking-[-0.04em]">{prettyFacultyName(member.name)}</h1>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">{member.designation || "Faculty"}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[0.65rem] font-bold text-teal-800 dark:bg-teal-950/45 dark:text-teal-300">
                    <Building2 className="h-3 w-3" aria-hidden="true" />
                    {member.department}
                  </span>
                  {liveStatus && <StatusPillText status={liveStatus} />}
                </div>
                {member.admin_roles && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    <span className="font-semibold">Additional roles · </span>
                    {member.admin_roles}
                  </p>
                )}
              </div>
            </div>

            {/* Contact details */}
            <div className="nl-enter mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {facultyEmails(member).map(email => (
                <ContactRow key={email} icon={<Mail className="h-4 w-4" aria-hidden="true" />} label="Email" value={email} href={`mailto:${email}`} />
              ))}
              {facultyMobileNumbers(member).filter(isDialablePhone).map(number => (
                <ContactRow key={`m-${number}`} icon={<Phone className="h-4 w-4" aria-hidden="true" />} label="Mobile" value={number} href={`tel:${number.replace(/[^+\d]/g, "")}`} />
              ))}
              {facultyDialableOfficeNumbers(member).map(number => (
                <ContactRow key={`o-${number}`} icon={<Phone className="h-4 w-4" aria-hidden="true" />} label="Office" value={number} href={`tel:${number.replace(/[^+\d]/g, "")}`} />
              ))}
              {facultyOfficeNumbers(member)
                .filter(number => isIntercom(number))
                .map(number => (
                  <ContactRow key={`i-${number}`} icon={<Phone className="h-4 w-4" aria-hidden="true" />} label="Office (intercom)" value={number} note="Internal extension — reachable through the college switchboard." />
                ))}
              {member.profile_url && (
                <ContactRow
                  icon={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
                  label="Official profile"
                  value="gndec.ac.in faculty page"
                  note="Photo and details come from the official college directory."
                />
              )}
            </div>

            {/* Weekly schedule — derived live from department room timetables. */}
            <section className="nl-enter mt-4 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/45 dark:text-teal-300">
                    <CalendarCheck className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold tracking-[-0.035em]">Weekly timetable</p>
                    <p className="text-xs text-muted-foreground">Discovered live from the department websites</p>
                  </div>
                </div>
                {slots && slots.length > 0 && (
                  <div className="nl-segment" role="tablist" aria-label="Schedule view">
                    <button type="button" role="tab" aria-selected={detailTab === "today"} data-active={detailTab === "today"} onClick={() => setDetailTab("today")} className="nl-segment-button">Today</button>
                    <button type="button" role="tab" aria-selected={detailTab === "week"} data-active={detailTab === "week"} onClick={() => setDetailTab("week")} className="nl-segment-button">Full week</button>
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                {roomsQuery.isLoading && !roomData ? (
                  <div className="rounded-2xl bg-muted/55 px-5 py-9 text-center">
                    <p className="text-sm font-semibold">Checking the department timetables…</p>
                    <p className="mt-1 text-xs text-muted-foreground">This only takes a moment.</p>
                  </div>
                ) : !slots || slots.length === 0 ? (
                  <div className="rounded-2xl bg-muted/55 px-5 py-9 text-center">
                    <Clock3 className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
                    <p className="mt-3 font-semibold">Timetable not available</p>
                    <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                      {member.department} does not publish a teacher timetable we can read, so this teacher's schedule can't be shown.
                      Contact details above are always available.
                    </p>
                  </div>
                ) : detailTab === "today" ? (
                  todayIndex === null ? (
                    <div className="rounded-2xl bg-muted/55 px-5 py-9 text-center">
                      <Sun className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      <p className="mt-3 font-semibold">No classes today</p>
                      <p className="mt-1 text-sm text-muted-foreground">It's the weekend — switch to the full week to see the schedule.</p>
                    </div>
                  ) : todaySlots.length === 0 ? (
                    <div className="rounded-2xl bg-muted/55 px-5 py-9 text-center">
                      <Sun className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
                      <p className="mt-3 font-semibold">No classes today</p>
                      <p className="mt-1 text-sm text-muted-foreground">A clear day — no scheduled slots for this teacher.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {todaySlots.map(slot => (
                        <ScheduleSlotRow key={`${slot.dayIndex}-${slot.slotIndex}`} slot={slot} now={now} />
                      ))}
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    {DAY_LABELS.slice(0, 6).map(day => {
                      const daySlots = slots.filter(slot => slot.dayIndex === DAY_LABELS.indexOf(day));
                      return (
                        <div key={day}>
                          <div className="mb-1.5 flex items-center justify-between gap-3 px-1">
                            <h3 className="text-[0.66rem] font-bold tracking-[0.12em] text-teal-700 dark:text-teal-300">{day.toUpperCase()}</h3>
                            <span className="text-[0.66rem] font-bold text-muted-foreground">{daySlots.length} {daySlots.length === 1 ? "class" : "classes"}</span>
                          </div>
                          {daySlots.length > 0 ? (
                            <div className="grid grid-cols-1 gap-1.5">
                              {daySlots.map(slot => (
                                <ScheduleSlotRow key={`${slot.dayIndex}-${slot.slotIndex}`} slot={slot} now={now} />
                              ))}
                            </div>
                          ) : (
                            <p className="rounded-xl bg-muted/45 px-3 py-2 text-xs text-muted-foreground">No scheduled classes.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {member.profile_url && (
              <a
                href={member.profile_url}
                target="_blank"
                rel="noreferrer"
                className="nl-enter mb-4 mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
              >
                View official profile on gndec.ac.in
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </section>
        )}
      </main>

      {/* Fullscreen photo viewer — tap the avatar to open it. */}
      {photoOpen && member?.image_url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${prettyFacultyName(member.name)} photo`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          onClick={() => setPhotoOpen(false)}
        >
          <button
            type="button"
            onClick={() => setPhotoOpen(false)}
            className="absolute right-4 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Close
          </button>
          <p className="absolute left-0 right-0 top-8 truncate px-14 text-center font-semibold text-white/85">{prettyFacultyName(member.name)}</p>
          <img
            src={member.image_url}
            alt={`${prettyFacultyName(member.name)} photo`}
            referrerPolicy="no-referrer"
            className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={event => event.stopPropagation()}
          />
        </div>
      )}

      <AppBottomNav />
    </div>
  );
}
