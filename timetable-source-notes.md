# Official GNDEC Timetable Source Notes

The configured official source is a single HTML document published by GNDEC. It contains a table of contents whose group links point to table anchors such as `#table_53` for **ITB2**. Each group timetable has a visible group label followed by a table with a time column and weekday columns from Monday through Friday.

The observed ITB2 timetable uses start times such as `08:30` through `15:30`. Empty periods are represented by `---` or blank cells. A populated cell is multiline text: it may include the group label, a subject, lecture/practical type, a teacher, and a room or lab. Therefore, the parser must preserve raw text, deterministically identify known timetable coordinates, and extract structured fields conservatively without altering group, day, or time.

The server will cache only a timetable after the source fetch succeeds and a valid set of group tables has parsed. If a later source request or parse fails, the application will continue to expose the most recently validated cached version with an explicit stale/error status.
