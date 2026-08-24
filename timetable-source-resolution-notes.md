# Live timetable source-resolution notes

The permanent official GNDEC index is <https://appsc.gndec.ac.in/time_tables>. On the implementation date, the first visible `Sub-section wise Time Table` anchor resolved to <https://appsc.gndec.ac.in/sites/default/files/2026-08/23_08_2026%20FINAL_FILE%20R4_subgroups_days_horizontal.html>.

The public fallback endpoint is <https://gndec-pyq-rag-api.vercel.app/api/timetable-source>. It was reachable without credentials and returned `{ "url": null, "source": "none" }`, which confirms that the resolver must retain the official discovery result and should treat a null fallback URL as unusable.

The web resolver will accept only HTTPS links on the exact `appsc.gndec.ac.in` host with an `.html` pathname. It will use the official index before the fallback endpoint, then preserve the last known good timetable source and payload if neither source can be resolved.

Production verification: the deployed `/app` dashboard loaded the current official group catalog, including `ITB2`, from the latest discovered R4 sub-section timetable. The official source was reachable, so the public fallback was not needed.

Direct release evidence: the production `timetable.dashboard` public procedure for `ITB2` returned `sourceUrl` as `https://appsc.gndec.ac.in/sites/default/files/2026-08/23_08_2026%20FINAL_FILE%20R4_subgroups_days_horizontal.html`. The previously bundled fallback URL used a different dated document, so this response confirms `nextlecture.vercel.app` is serving the `b049138` official-first resolver release.

## Optional external-backend fallback configuration

The public fallback service is maintained separately from NextLecture. If its owner wishes to configure an emergency source URL, add the following **server-only Production** environment variable on the `gndec-pyq-rag-api` Vercel project and redeploy that backend:

```text
Timetable_url=https://appsc.gndec.ac.in/sites/default/files/2026-08/23_08_2026%20FINAL_FILE%20R4_subgroups_days_horizontal.html
```

`TIMETABLE_URL` is accepted as an uppercase alias. The NextLecture app will still always try the permanent official GNDEC index first; this variable is only read through the public fallback endpoint when official discovery fails. No credential is required by students or exposed in browser code.
