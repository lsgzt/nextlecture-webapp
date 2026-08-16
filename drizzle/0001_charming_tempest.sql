CREATE TABLE `timetable_cache` (
	`id` varchar(64) NOT NULL,
	`sourceUrl` varchar(1024) NOT NULL,
	`payload` longtext NOT NULL,
	`fetchedAt` timestamp NOT NULL,
	CONSTRAINT `timetable_cache_id` PRIMARY KEY(`id`)
);
