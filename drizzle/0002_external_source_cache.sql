CREATE TABLE `external_source_cache` (
	`id` varchar(64) NOT NULL,
	`sourceUrl` varchar(1024) NOT NULL,
	`payload` longtext NOT NULL,
	`fetchedAt` timestamp NOT NULL,
	CONSTRAINT `external_source_cache_id` PRIMARY KEY(`id`)
);
