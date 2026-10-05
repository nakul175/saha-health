import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
// Release 0.1 source is retained unchanged as a migration and rollback reference.
export const workspaces = sqliteTable('workspaces', {
  ownerId: text('owner_id').primaryKey(), revision: integer('revision').notNull().default(1),
  state: text('state').notNull(), updatedAt: text('updated_at').notNull(),
});
export const accounts = sqliteTable('accounts', {
  userId:text('user_id').primaryKey(), accountCode:text('account_code').notNull().unique(),
  displayName:text('display_name').notNull(), email:text('email').notNull(), activeOrgId:text('active_org_id'), createdAt:text('created_at').notNull(),
});
export const organisations = sqliteTable('organisations', {
  id:text('id').primaryKey(), name:text('name').notNull(), revision:integer('revision').notNull().default(1),
  lastCommand:text('last_command').notNull(), createdAt:text('created_at').notNull(),
  // Slice 0a: counts patient-scoped commits. Organisation-wide commands guard on it;
  // patient-scoped commands only increment it and guard on the organisation revision.
  patientRevision:integer('patient_revision').notNull().default(0),
});
export const teams = sqliteTable('teams', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), name:text('name').notNull(), createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]}),uniqueIndex('teams_org_name').on(t.orgId,t.name)]);
export const memberships = sqliteTable('memberships', {
  orgId:text('org_id').notNull().references(()=>organisations.id), userId:text('user_id').notNull().references(()=>accounts.userId),
  role:text('role').notNull(), isOwner:integer('is_owner').notNull().default(0), status:text('status').notNull(), version:integer('version').notNull(), createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.userId]}),index('memberships_user_status').on(t.userId,t.status)]);
export const teamMembers = sqliteTable('team_members', {
  orgId:text('org_id').notNull().references(()=>organisations.id), teamId:text('team_id').notNull(), userId:text('user_id').notNull().references(()=>accounts.userId),
},t=>[primaryKey({columns:[t.orgId,t.teamId,t.userId]})]);
export const invitations = sqliteTable('invitations', {
  id:text('id').primaryKey(), orgId:text('org_id').notNull().references(()=>organisations.id), tokenHash:text('token_hash').notNull().unique(),
  accountCode:text('account_code').notNull(), label:text('label').notNull(), role:text('role').notNull(), teamIds:text('team_ids').notNull(),
  status:text('status').notNull(), expiresAt:text('expires_at').notNull(), createdBy:text('created_by').notNull(), createdAt:text('created_at').notNull(), acceptedBy:text('accepted_by'),
},t=>[index('invitations_org_status').on(t.orgId,t.status)]);
export const patients = sqliteTable('patients', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), version:integer('version').notNull(),
  name:text('name').notNull(), teamId:text('team_id').notNull(), assignedTo:text('assigned_to'), data:text('data').notNull(),
  // Slice 0a: per-patient concurrency counter. Distinct from `version`, which binds approvals.
  rev:integer('rev').notNull().default(0),
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('patients_org_team').on(t.orgId,t.teamId),index('patients_org_assignee').on(t.orgId,t.assignedTo)]);
export const visits = sqliteTable('visits', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), personId:text('person_id').notNull(),
  version:integer('version').notNull(), recordVersion:integer('record_version').notNull(), state:text('state').notNull(), data:text('data').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('visits_org_person').on(t.orgId,t.personId)]);
export const integrations = sqliteTable('integrations', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), version:integer('version').notNull(), kind:text('kind').notNull(), status:text('status').notNull(), data:text('data').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]})]);
export const plans = sqliteTable('plans', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), visitId:text('visit_id').notNull(), state:text('state').notNull(), data:text('data').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('plans_org_visit').on(t.orgId,t.visitId)]);
export const aiResults = sqliteTable('ai_results', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), visitId:text('visit_id').notNull(), data:text('data').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('ai_results_org_visit').on(t.orgId,t.visitId)]);
export const submissions = sqliteTable('submissions', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), visitId:text('visit_id').notNull(), personId:text('person_id').notNull(), state:text('state').notNull(), data:text('data').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('submissions_org_person').on(t.orgId,t.personId)]);
export const referrals = sqliteTable('referrals', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), personId:text('person_id').notNull(), data:text('data').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('referrals_org_person').on(t.orgId,t.personId)]);
export const recordRevisions = sqliteTable('record_revisions', {
  id:text('id').primaryKey(), orgId:text('org_id').notNull().references(()=>organisations.id), personId:text('person_id').notNull(), entityType:text('entity_type').notNull(), entityId:text('entity_id').notNull(),
  version:integer('version').notNull(), actorId:text('actor_id').notNull(), actorName:text('actor_name').notNull(), action:text('action').notNull(), reason:text('reason').notNull(), data:text('data').notNull(), changes:text('changes').notNull(), createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('revisions_entity_version').on(t.orgId,t.entityType,t.entityId,t.version),index('revisions_org_person_time').on(t.orgId,t.personId,t.createdAt)]);
export const auditEvents = sqliteTable('audit_events', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), personId:text('person_id'), actorId:text('actor_id').notNull(), actorName:text('actor_name').notNull(), role:text('role').notNull(), action:text('action').notNull(), subject:text('subject').notNull(), detail:text('detail').notNull(), at:text('at').notNull(),
  // Slice 6j: per-organisation hash chain. Null on events written before the chain started;
  // those are sealed by the organisation's genesis event (seq 0) instead of being rewritten.
  seq:integer('seq'), prevHash:text('prev_hash'), hash:text('hash'),
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('audit_org_person_time').on(t.orgId,t.personId,t.at),uniqueIndex('audit_org_seq').on(t.orgId,t.seq),
  // Slice 13e (round-11 O-4): the newest events of an organisation, and one person's recent events of one kind (rate limits,
  // repeat-read windows), without scanning the organisation's whole log.
  index('audit_org_time').on(t.orgId,t.at),index('audit_org_actor_action_time').on(t.orgId,t.actorId,t.action,t.at)]);
export const commandReceipts = sqliteTable('command_receipts', {
  actorId:text('actor_id').notNull(), key:text('key').notNull(), orgId:text('org_id').notNull().references(()=>organisations.id), hash:text('hash').notNull(), result:text('result').notNull(), personId:text('person_id'), createdAt:text('created_at').notNull(),
},t=>[primaryKey({columns:[t.actorId,t.key]})]);
export const legacyMigrations = sqliteTable('legacy_migrations', {
  ownerId:text('owner_id').primaryKey(), orgId:text('org_id').notNull().references(()=>organisations.id), sourceRevision:integer('source_revision').notNull(), sourceHash:text('source_hash').notNull(), counts:text('counts').notNull(), migratedAt:text('migrated_at').notNull(),
});
// Release 7 operations settings contain no clinical records or credentials.
export const operations = sqliteTable('operations', {
 orgId:text('org_id').primaryKey().references(()=>organisations.id), data:text('data').notNull(),
});
export const requestMetrics = sqliteTable('request_metrics', {
 orgId:text('org_id').notNull().references(()=>organisations.id), bucket:text('bucket').notNull(), route:text('route').notNull(), status:integer('status').notNull(),
 count:integer('count').notNull(), totalMs:integer('total_ms').notNull(), maxMs:integer('max_ms').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.bucket,t.route,t.status]})]);
// Slice 6v: in-app alert delivery. Occurrences and notifications carry alert ids, titles, counts and member ids only,
// never patient names or clinical content. They sit outside the organisation record so a delivery never moves its revision.
export const alertOccurrences = sqliteTable('alert_occurrences', {
 orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), alertId:text('alert_id').notNull(), scopeKey:text('scope_key').notNull(), ownerRole:text('owner_role').notNull(), severity:text('severity').notNull(), title:text('title').notNull(),
 openedAt:text('opened_at').notNull(), closedAt:text('closed_at'), escalatedAt:text('escalated_at'), escalatedTo:text('escalated_to'), escalationReason:text('escalation_reason'), escalationRecipients:integer('escalation_recipients'),
},t=>[primaryKey({columns:[t.orgId,t.id]}),uniqueIndex('alert_occurrence_open').on(t.orgId,t.alertId,t.scopeKey).where(sql`closed_at IS NULL`)]);
export const alertNotifications = sqliteTable('alert_notifications', {
 orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), occurrenceId:text('occurrence_id').notNull(), userId:text('user_id').notNull(), level:integer('level').notNull(), alertId:text('alert_id').notNull(), scopeKey:text('scope_key').notNull(), ownerRole:text('owner_role').notNull(), severity:text('severity').notNull(), title:text('title').notNull(),
 count:integer('count'), detail:text('detail'), deliveredAt:text('delivered_at').notNull(), readAt:text('read_at'), clearedAt:text('cleared_at'), clearedReason:text('cleared_reason'),
},t=>[primaryKey({columns:[t.orgId,t.id]}),uniqueIndex('alert_notification_once').on(t.orgId,t.occurrenceId,t.userId,t.level),index('alert_notification_inbox').on(t.orgId,t.userId,t.clearedAt,t.deliveredAt)]);

// Slice 10b: the out-of-app notification channel's message log (demonstration simulator only). Rows hold alert ids, titles,
// counts, member ids, a fixed link path and the simulator receipt; never patient names, identifiers or a real address or
// number. Unique per occurrence, tier and recipient, so an evaluation repeated or run concurrently never sends twice.
export const notificationMessages = sqliteTable('notification_messages', {
 orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), occurrenceId:text('occurrence_id').notNull(), alertId:text('alert_id').notNull(), scopeKey:text('scope_key').notNull(), tier:integer('tier').notNull(), rung:integer('rung').notNull(), userId:text('user_id').notNull(),
 channel:text('channel').notNull(), reason:text('reason').notNull(), severity:text('severity').notNull(), title:text('title').notNull(), count:integer('count'), subject:text('subject'), body:text('body').notNull(), link:text('link').notNull(), address:text('address').notNull(), status:text('status').notNull(), receipt:text('receipt').notNull(),
 dueAt:text('due_at').notNull(), sentAt:text('sent_at').notNull(), auditId:text('audit_id').notNull(), configVersion:integer('config_version').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]}),uniqueIndex('notification_message_once').on(t.orgId,t.occurrenceId,t.tier,t.userId),index('notification_message_log').on(t.orgId,t.sentAt)]);
// Bounded rehearsal configuration and evidence. No clinical records or credentials.
export const pilot = sqliteTable('pilot', {
 orgId:text('org_id').primaryKey().references(()=>organisations.id), data:text('data').notNull(),
});
export const outreach = sqliteTable('outreach', {
 orgId:text('org_id').primaryKey().references(()=>organisations.id), data:text('data').notNull(),
});
export const expansions = sqliteTable('expansions', {
 orgId:text('org_id').primaryKey().references(()=>organisations.id), data:text('data').notNull(),
});

// Versioned review packages, synthetic evaluations and scoped safety cases.
export const governance = sqliteTable('governance', {
 orgId:text('org_id').primaryKey().references(()=>organisations.id), data:text('data').notNull(),
});
// Slice 1: households. Membership and history live in versioned JSON; staff access is never derived from it.
export const households = sqliteTable('households', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), version:integer('version').notNull(),
  teamId:text('team_id').notNull(), data:text('data').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('households_org_team').on(t.orgId,t.teamId)]);
// Slice 1b: bulk caseload transfers with effective time, application result and acknowledgement.
export const caseloadTransfers = sqliteTable('caseload_transfers', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), version:integer('version').notNull(),
  teamId:text('team_id').notNull(), state:text('state').notNull(), createdAt:text('created_at').notNull(), data:text('data').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('caseload_transfers_org_state').on(t.orgId,t.state)]);
// Slice 1c: identity merge cases with their downstream impact queue. Merges link records; nothing is moved or deleted.
export const identityCases = sqliteTable('identity_cases', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), version:integer('version').notNull(),
  state:text('state').notNull(), survivorId:text('survivor_id').notNull(), duplicateId:text('duplicate_id').notNull(), createdAt:text('created_at').notNull(), data:text('data').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('identity_cases_survivor').on(t.orgId,t.survivorId),index('identity_cases_duplicate').on(t.orgId,t.duplicateId)]);
// Slice 6b: rights and grievance requests with due dates, outcomes and destination notifications.
export const rightsRequests = sqliteTable('rights_requests', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), version:integer('version').notNull(),
  state:text('state').notNull(), personId:text('person_id').notNull(), dueAt:text('due_at').notNull(), createdAt:text('created_at').notNull(), data:text('data').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('rights_requests_person').on(t.orgId,t.personId),index('rights_requests_open').on(t.orgId,t.state,t.dueAt)]);
// Slice 6c: retention schedules and legal holds. Review only; nothing is deleted.
export const retention = sqliteTable('retention', {
 orgId:text('org_id').primaryKey().references(()=>organisations.id), data:text('data').notNull(),
});
// Slice 2b: small visit media (photos and voice notes) with type, size and purpose; tombstoned on draft removal.
export const media = sqliteTable('media', {
  orgId:text('org_id').notNull().references(()=>organisations.id), id:text('id').notNull(), personId:text('person_id').notNull(), visitId:text('visit_id').notNull(),
  mime:text('mime').notNull(), size:integer('size').notNull(), sha256:text('sha256').notNull(), purpose:text('purpose').notNull(), createdAt:text('created_at').notNull(), deletedAt:text('deleted_at'), data:text('data').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('media_org_visit').on(t.orgId,t.visitId),index('media_org_person').on(t.orgId,t.personId)]);
// Slice 13d (round-10 review M2): where the scheduled job's organisation rotation stopped, so the next run continues from
// the organisation after it (wrapping at the end). One row per job; holds an organisation id and a time, nothing else.
export const scheduledCursor = sqliteTable('scheduled_cursor', {
 job:text('job').primaryKey(), lastOrg:text('last_org').notNull(), updatedAt:text('updated_at').notNull(),
});

// Internal anti-enumeration reservations. Not patient records and excluded from organisation data exit.
export const abhaReviewReservations = sqliteTable('abha_review_reservations', {
 orgId:text('org_id').notNull(), userId:text('user_id').notNull(), attemptHash:text('attempt_hash').notNull(),
 payloadHash:text('payload_hash').notNull(), probeHash:text('probe_hash').notNull(), at:text('at').notNull(), reviewEventId:text('review_event_id'),
},t=>[primaryKey({columns:[t.orgId,t.userId,t.attemptHash]}),uniqueIndex('abha_review_probe').on(t.orgId,t.userId,t.probeHash),index('abha_review_time').on(t.orgId,t.userId,t.at)]);

// Fixed-cadence operational samples; immutable history enforced by migration triggers.
export const availabilitySamples=sqliteTable('availability_samples',{
 orgId:text('org_id').notNull(),slot:integer('slot').notNull(),source:text('source').notNull(),configVersion:integer('config_version').notNull(),
 core:text('core').notNull(),workflow:text('workflow').notNull(),latencyMs:integer('latency_ms').notNull(),receiptHash:text('receipt_hash').notNull(),recordedAt:text('recorded_at').notNull(),
},t=>[primaryKey({columns:[t.orgId,t.slot,t.source]})]);
