# Live timetable source-resolution notes

The permanent official GNDEC index is <https://appsc.gndec.ac.in/time_tables>. On the implementation date, the first visible `Sub-section wise Time Table` anchor resolved to <https://appsc.gndec.ac.in/sites/default/files/2026-08/23_08_2026%20FINAL_FILE%20R4_subgroups_days_horizontal.html>.

The public fallback endpoint is <https://gndec-pyq-rag-api.vercel.app/api/timetable-source>. It was reachable without credentials and returned `{ "url": null, "source": "none" }`, which confirms that the resolver must retain the official discovery result and should treat a null fallback URL as unusable.

The web resolver will accept only HTTPS links on the exact `appsc.gndec.ac.in` host with an `.html` pathname. It will use the official index before the fallback endpoint, then preserve the last known good timetable source and payload if neither source can be resolved.
