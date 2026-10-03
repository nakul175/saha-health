CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`customer` text NOT NULL,
	`hash` text NOT NULL,
	`status` text NOT NULL,
	`result` text,
	`created` text NOT NULL
);
