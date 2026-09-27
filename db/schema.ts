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
},t=>[primaryKey({columns:[t.orgId,t.id]}),index('audit_org_person_time').on(t.orgId,t.personId,t.at)]);
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

// Bounded rehearsal configuration and evidence. No clinical records or credentials.
export const pilot = sqliteTable('pilot', {
 orgId:text('org_id').primaryKey().references(()=>organisations.id), data:text('data').notNull(),
});
