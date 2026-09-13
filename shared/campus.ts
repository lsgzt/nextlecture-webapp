/**
 * Official GNDEC holidays + ERP/homepage notices.
 * Same feed shapes as nextlecture-android (HolidayManager / ErpNoticeManager).
 */

export type CampusHoliday = {
  id: string;
  name: string;
  date: string;
  displayDate: string;
  weekday: string;
  category: string;
  year: number;
  source: string;
};

export type CampusNotice = {
  id: string;
  title: string;
  publishedDate: string;
  displayDate: string;
  url: string;
  author: string;
  source: string;
  firstSeenAt: string;
  bannerStartDate: string;
  bannerUntilDate: string;
};

export type HolidayFeed = {
  holidays: CampusHoliday[];
  fetchedAt: string | null;
  servedFromCache: boolean;
  stale: boolean;
  refreshError: string | null;
};

export type NoticeFeed = {
  notices: CampusNotice[];
  fetchedAt: string | null;
  servedFromCache: boolean;
  stale: boolean;
  refreshError: string | null;
};

export const HOLIDAY_CATEGORIES = [
  { label: "PUBLIC HOLIDAYS", category: "Public holiday" },
  { label: "RESTRICTED HOLIDAYS", category: "Restricted holiday" },
  { label: "HALF-DAY HOLIDAYS", category: "Half-day holiday" },
] as const;

export const OFFICIAL_NOTICE_BOARD_URL = "https://erp.gndec.ac.in/notice";
