CREATE INDEX `audit_org_time` ON `audit_events` (`org_id`,`at`);--> statement-breakpoint
CREATE INDEX `audit_org_actor_action_time` ON `audit_events` (`org_id`,`actor_id`,`action`,`at`);