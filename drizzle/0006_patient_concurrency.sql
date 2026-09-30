ALTER TABLE `organisations` ADD `patient_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `patients` ADD `rev` integer DEFAULT 0 NOT NULL;