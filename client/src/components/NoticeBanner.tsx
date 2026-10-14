import { ChevronRight, Megaphone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CampusNotice } from "@shared/campus";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function noticeDate(notice: CampusNotice) {
  return notice.bannerStartDate || notice.publishedDate || "";
}

function noticeUntilDate(notice: CampusNotice) {
  if (notice.bannerUntilDate) return notice.bannerUntilDate;
  const start = noticeDate(notice);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return "";
  const date = new Date(`${start}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return localDateKey(date);
}

export function getActiveNoticeBanners(
  notices: CampusNotice[],
  today = localDateKey()
) {
  return notices.filter(notice => {
    const start = noticeDate(notice);
    const until = noticeUntilDate(notice);
    return Boolean(
      notice.title && start && until && start <= today && today <= until
    );
  });
}

export function NoticeBanner({
  notices,
  className = "",
}: {
  notices: CampusNotice[];
  className?: string;
}) {
  const [today, setToday] = useState(() => localDateKey());
  const activeNotices = useMemo(
    () => getActiveNoticeBanners(notices, today),
    [notices, today]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDateKey()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setActiveIndex(index =>
      Math.min(index, Math.max(0, activeNotices.length - 1))
    );
  }, [activeNotices.length]);

  useEffect(() => {
    if (activeNotices.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex(index => (index + 1) % activeNotices.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeNotices.length]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || !activeNotices.length) return;
    const card = scroller.children[activeIndex] as HTMLElement | undefined;
    card?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeIndex, activeNotices.length]);

  if (!activeNotices.length) return null;

  return (
    <section className={className} aria-label="New official GNDEC notices">
      <div
        ref={scrollerRef}
        className="flex h-52 snap-x snap-mandatory items-stretch gap-3 overflow-x-auto overscroll-x-contain rounded-[1.5rem] scrollbar-none touch-pan-x sm:h-56"
        onScroll={event => {
          const element = event.currentTarget;
          const width = element.clientWidth + 12;
          const nextIndex = Math.round(element.scrollLeft / width);
          if (
            nextIndex !== activeIndex &&
            nextIndex >= 0 &&
            nextIndex < activeNotices.length
          )
            setActiveIndex(nextIndex);
        }}
      >
        {activeNotices.map(notice => (
          <a
            key={notice.id}
            href={notice.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex h-full min-h-0 w-full shrink-0 snap-center items-center gap-3 overflow-hidden rounded-[1.5rem] border border-amber-400/70 bg-amber-700 px-5 py-5 text-amber-50 shadow-lg shadow-amber-950/15 transition hover:bg-amber-800 active:scale-[0.995] dark:border-amber-500/45 dark:bg-amber-900/80 dark:text-amber-50 dark:hover:bg-amber-900"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-500/30 text-amber-100 dark:bg-amber-500/25">
              <Megaphone className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 pr-2">
              <span className="block text-[0.68rem] font-bold uppercase tracking-[0.15em] text-amber-100/85">
                New · {notice.source || "GNDEC"}
              </span>
              <span className="mt-1 block max-h-[3.5rem] overflow-hidden text-lg font-bold leading-7 tracking-[-0.02em] sm:text-xl">
                {notice.title}
              </span>
              <span className="mt-1.5 block text-sm text-amber-100/85">
                Tap to open official notice
              </span>
            </span>
            <ChevronRight
              className="h-6 w-6 shrink-0 text-amber-100 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
      {activeNotices.length > 1 && (
        <div
          className="mt-2 flex justify-center gap-1.5"
          aria-label={`${activeIndex + 1} of ${activeNotices.length} notices`}
        >
          {activeNotices.map((notice, index) => (
            <span
              key={notice.id}
              className={`h-1.5 w-10 rounded-full transition-colors ${index === activeIndex ? "bg-teal-500 dark:bg-teal-400" : "bg-muted"}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
