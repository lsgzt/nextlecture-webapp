# Production timetable outage investigation

## Initial evidence

On the reported production URL, `/app` rendered the timetable dashboard shell but did not complete its official group request. Two direct observations showed the page remaining on “Loading the official timetable groups…” without groups or cached timetable data. The user’s mobile screenshot later reached the corresponding “The official timetable is unavailable” error state.

The next investigation step is to inspect the production tRPC timetable procedures and deployed runtime logs, then distinguish an official GNDEC-source failure from a Vercel deployment or server-bundle regression. No attendance, Syllabus AI, or Previous Year Papers code is to be changed unless regression evidence requires it.

## Resolver diagnosis

Vercel runtime logs recorded repeated `502` responses from the public `timetable.groups` and `timetable.dashboard` procedures during the outage. The official GNDEC index simultaneously failed from the server environment with a TLS connection closure. The public timetable-source fallback did not supply a usable body during that period, and a cold Vercel function had no in-memory cache to serve.

The official host subsequently responded normally over HTTPS. The production `timetable.groups` tRPC query then returned the complete group list, and a fresh production `/app` visit displayed the group picker, including `ITB2`. This confirms the deployment was healthy; the user-facing incident was an intermittent upstream connectivity failure that the current resolver exhausted too quickly on cold instances.

## Recovery deployment

Commit `59aeb74` adds a final, server-only emergency source: a verified copy of the official R4 timetable captured on 24 Aug 2026. It is reached only after official discovery, the public source fallback, and the live official timetable document all fail. The snapshot is parsed by the same semantic parser and must still contain the requested saved subsection; it does not bypass validation or alter the official-first order. The full suite passed with 53 tests, the Vercel bundle built successfully, and the production `/app` group picker loaded `ITB2` and the current official group list after deployment.

Vercel production deployment metadata confirms the `READY` deployment `dpl_BeLnHWCXciBKNJQpHbwPaG9z8tqK` is serving `nextlecture.vercel.app` from GitHub commit `59aeb748c36489d9cbe3d32f74fb16ca39ed6cf1`, whose message is `fix: recover timetable during upstream outages`.
