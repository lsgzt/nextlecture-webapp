# Production timetable outage investigation

## Initial evidence

On the reported production URL, `/app` rendered the timetable dashboard shell but did not complete its official group request. Two direct observations showed the page remaining on “Loading the official timetable groups…” without groups or cached timetable data. The user’s mobile screenshot later reached the corresponding “The official timetable is unavailable” error state.

The next investigation step is to inspect the production tRPC timetable procedures and deployed runtime logs, then distinguish an official GNDEC-source failure from a Vercel deployment or server-bundle regression. No attendance, Syllabus AI, or Previous Year Papers code is to be changed unless regression evidence requires it.

## Resolver diagnosis

Vercel runtime logs recorded repeated `502` responses from the public `timetable.groups` and `timetable.dashboard` procedures during the outage. The official GNDEC index simultaneously failed from the server environment with a TLS connection closure. The public timetable-source fallback did not supply a usable body during that period, and a cold Vercel function had no in-memory cache to serve.

The official host subsequently responded normally over HTTPS. The production `timetable.groups` tRPC query then returned the complete group list, and a fresh production `/app` visit displayed the group picker, including `ITB2`. This confirms the deployment was healthy; the user-facing incident was an intermittent upstream connectivity failure that the current resolver exhausted too quickly on cold instances.
