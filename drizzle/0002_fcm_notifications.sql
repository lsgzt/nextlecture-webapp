CREATE TABLE `fcm_tokens` (
  `token` varchar(4096) NOT NULL,
  `platform` varchar(32) NOT NULL DEFAULT 'android',
  `appVersion` varchar(64),
  `active` int NOT NULL DEFAULT 1,
  `lastSeenAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`token`)
);

CREATE TABLE `notification_state` (
  `key` varchar(128) NOT NULL,
  `fingerprint` varchar(128) NOT NULL,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`key`)
);
