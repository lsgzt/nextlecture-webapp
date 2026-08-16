# NextLecture

NextLecture is a mobile-first web companion for GNDEC students. It reduces the official timetable to a fast answer: **what is my next lecture, when does it start, and where do I go?** The public landing page is served at `/`, and the timetable dashboard is at `/app`.

## Configuration

The product-level settings are intentionally centralized in [`shared/config.ts`](./shared/config.ts). Update `ANDROID_APP_URL` there when the Android APK is available. The official source URL and application API base path live alongside it as `TIMETABLE_SOURCE_URL` and `BACKEND_API_URL`.

## Timetable data flow

The server retrieves the official GNDEC HTML timetable, parses its semantic table markup, and returns data through public typed procedures. The parser reads the group list, day headers, time slots, subjects, teachers, rooms, activity types, and multi-period `rowspan` durations directly from the source. It does not use OCR.

Only fully valid parses are cached. A durable `timetable_cache` table holds the last validated source payload, while an in-memory cache prevents redundant upstream requests during active runtime. A failed refresh leaves the last successful data in place and surfaces a stale-data notice to the student.

## Student experience

Students do not need an account. Their selected timetable group and latest successful dashboard response are stored locally in the browser. The application shell is installable as a PWA, and the saved timetable remains available when the student is offline. The web application never promises Android-equivalent background reminders; the Android app remains the recommended option for timely reminders.

## Development

Run the following commands from the project root:

```bash
pnpm test
pnpm check
pnpm build
```

The test suite covers deterministic parser behavior, structured lecture field extraction, multi-slot lessons, free-period time coordinates, malformed source protection, and the existing session logout contract.

## Accessibility

The pages use semantic headings, native buttons and selects, associated form labels, descriptive labels for icon-only controls, and status text that does not rely on color alone. Both routes have a high-contrast visible keyboard focus ring. The interface honors reduced-motion preferences by disabling nonessential animation and smooth scrolling. Mobile touch targets are at least 40–48 pixels in the application header, primary buttons, form controls, and schedule controls.

## Data source

NextLecture only reads from the [official GNDEC timetable source](https://appsc.gndec.ac.in/sites/default/files/2026-08/09_08_2026%20FINAL_FILE_subgroups_days_horizontal.html). The timetable source may change its publication location or HTML layout. If it does, update `TIMETABLE_SOURCE_URL` and adjust the defensive parser in [`server/timetable.ts`](./server/timetable.ts) as needed.
