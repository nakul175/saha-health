-- Proposed PostgreSQL foundation DDL. See Data Model document for activation and migration gates.

-- Runtime role must be non-owner and NOBYPASSRLS. This script does not provision identities or secrets.

BEGIN;

CREATE SCHEMA IF NOT EXISTS health;

CREATE TABLE health.tenant (id uuid PRIMARY KEY, name text NOT NULL, environment text NOT NULL CHECK (environment IN ('synthetic','test','production')));

CREATE TABLE health.person (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "display_name" text NOT NULL,
  "birth_date" date,
  "age_basis" text NOT NULL CHECK ("age_basis" IN ('verified_date','reported_date','reported_age','unknown')),
  "reported_age_years" bigint CHECK ("reported_age_years" >= 0),
  "identity_status" text NOT NULL CHECK ("identity_status" IN ('provisional','confirmed','disputed')),
  "preferred_language" text NOT NULL,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.person ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.person FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.person USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX person_updated_idx ON health.person (tenant_id,updated_at,id);

CREATE TABLE health.identifier_link (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid NOT NULL,
  "issuer" text NOT NULL,
  "external_identifier" text NOT NULL,
  "verification" text NOT NULL CHECK ("verification" IN ('unverified','verified','disputed','superseded')),
  "evidence_ref" text,
  "supersedes_id" uuid,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.identifier_link ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.identifier_link FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.identifier_link USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX identifier_link_updated_idx ON health.identifier_link (tenant_id,updated_at,id);

CREATE TABLE health.household_membership (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid NOT NULL,
  "household_id" uuid NOT NULL,
  "relationship" text NOT NULL,
  "effective_from" timestamptz NOT NULL,
  "effective_to" timestamptz,
  "proxy_authority_id" uuid,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.household_membership ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.household_membership FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.household_membership USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX household_membership_updated_idx ON health.household_membership (tenant_id,updated_at,id);

CREATE TABLE health.encounter (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid NOT NULL,
  "programme_ids" jsonb NOT NULL,
  "episode_ref" text,
  "state" text NOT NULL CHECK ("state" IN ('draft','confirmed','void')),
  "started_at" timestamptz NOT NULL,
  "confirmed_at" timestamptz,
  "confirmed_by" uuid,
  "patient_context_hash" text NOT NULL,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.encounter ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.encounter FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.encounter USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX encounter_updated_idx ON health.encounter (tenant_id,updated_at,id);

CREATE TABLE health.observation (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid NOT NULL,
  "encounter_id" uuid NOT NULL,
  "concept_code" text NOT NULL,
  "concept_system" text NOT NULL,
  "effective_at" timestamptz NOT NULL,
  "source_type" text NOT NULL CHECK ("source_type" IN ('measured','reported','imported','derived')),
  "verification" text NOT NULL CHECK ("verification" IN ('draft','confirmed','disputed')),
  "value" jsonb,
  "absent_reason" text CHECK ("absent_reason" IN ('unknown','not_asked','refused','not_applicable')),
  "source_ref" text,
  "author_id" uuid NOT NULL,
  "supersedes_id" uuid,
  PRIMARY KEY (tenant_id,id),
  CHECK ((value IS NOT NULL)::integer + (absent_reason IS NOT NULL)::integer = 1)
);

ALTER TABLE health.observation ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.observation FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.observation USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX observation_updated_idx ON health.observation (tenant_id,updated_at,id);

CREATE TABLE health.conflict (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "resource_type" text NOT NULL,
  "resource_id" uuid NOT NULL,
  "base_version" bigint NOT NULL CHECK ("base_version" >= 0),
  "candidate_refs" jsonb NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('open','resolved','unresolved')),
  "resolution_ref" text,
  "owner_id" uuid NOT NULL,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.conflict ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.conflict FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.conflict USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX conflict_updated_idx ON health.conflict (tenant_id,updated_at,id);

CREATE TABLE health.authority_record (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid NOT NULL,
  "purpose" text NOT NULL,
  "basis" text NOT NULL CHECK ("basis" IN ('consent','other_approved_basis')),
  "basis_ref" text NOT NULL,
  "recipient_ids" jsonb NOT NULL,
  "data_types" jsonb NOT NULL,
  "actions" jsonb NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('requested','active','denied','revoked','expired','superseded')),
  "valid_from" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "notice_version" text,
  "external_artefact_ref" text,
  "date_from" timestamptz,
  "date_to" timestamptz,
  PRIMARY KEY (tenant_id,id),
  CHECK (expires_at > valid_from)
);

ALTER TABLE health.authority_record ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.authority_record FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.authority_record USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX authority_record_updated_idx ON health.authority_record (tenant_id,updated_at,id);

CREATE TABLE health.programme_pack (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "programme_id" text NOT NULL,
  "pack_version" text NOT NULL,
  "schema_ref" text NOT NULL,
  "rules_hash" text NOT NULL,
  "mapping_refs" jsonb NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('draft','validated','reviewed','active','retired')),
  "effective_from" timestamptz NOT NULL,
  "approval_refs" jsonb NOT NULL,
  "language_versions" jsonb NOT NULL,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.programme_pack ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.programme_pack FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.programme_pack USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX programme_pack_updated_idx ON health.programme_pack (tenant_id,updated_at,id);

CREATE TABLE health.task (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid NOT NULL,
  "encounter_id" uuid,
  "task_type" text NOT NULL,
  "owner_ref" text NOT NULL,
  "due_at" timestamptz,
  "reason_codes" jsonb NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('open','assigned','in_progress','completed','unresolved','cancelled')),
  "evidence_ref" text,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.task ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.task FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.task USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX task_updated_idx ON health.task (tenant_id,updated_at,id);

CREATE TABLE health.referral (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid NOT NULL,
  "encounter_id" uuid NOT NULL,
  "reason_codes" jsonb NOT NULL,
  "destination_id" uuid NOT NULL,
  "owner_ref" text NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('proposed','authorised','sent','received','scheduled','attended','completed','declined','cancelled','unresolved')),
  "due_at" timestamptz,
  "authority_id" uuid NOT NULL,
  "evidence_refs" jsonb NOT NULL,
  "outcome_code" text,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.referral ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.referral FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.referral USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX referral_updated_idx ON health.referral (tenant_id,updated_at,id);

CREATE TABLE health.provider_capability (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "provider_id" text NOT NULL,
  "capability_key" text NOT NULL,
  "manifest_version" text NOT NULL,
  "provider_release_id" text NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('registered','verified','under_review','approved','active','suspended','retired')),
  "manifest_ref" text NOT NULL,
  "intended_use" text NOT NULL,
  "input_schema_ref" text NOT NULL,
  "output_schema_ref" text NOT NULL,
  "population_rule_ref" text NOT NULL,
  "approval_refs" jsonb NOT NULL,
  "region" text NOT NULL,
  "cost_ceiling_minor" bigint NOT NULL CHECK ("cost_ceiling_minor" >= 0),
  "currency" text NOT NULL,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.provider_capability ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.provider_capability FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.provider_capability USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX provider_capability_updated_idx ON health.provider_capability (tenant_id,updated_at,id);

CREATE TABLE health.a_i_request (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid NOT NULL,
  "encounter_id" uuid NOT NULL,
  "capability_id" uuid NOT NULL,
  "manifest_version" text NOT NULL,
  "input_refs" jsonb NOT NULL,
  "input_hash" text NOT NULL,
  "authority_id" uuid NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('prepared','queued','running','succeeded','unable_to_assess','failed','cancelling','cancelled')),
  "deadline_at" timestamptz NOT NULL,
  "max_cost_minor" bigint NOT NULL CHECK ("max_cost_minor" >= 0),
  "currency" text NOT NULL,
  "result_id" uuid,
  "failure_code" text,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.a_i_request ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.a_i_request FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.a_i_request USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX a_i_request_updated_idx ON health.a_i_request (tenant_id,updated_at,id);

CREATE TABLE health.a_i_result (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "request_id" uuid NOT NULL,
  "provider_release_id" text NOT NULL,
  "output_schema_ref" text NOT NULL,
  "output_ref" text NOT NULL,
  "output_hash" text NOT NULL,
  "quality_state" text NOT NULL CHECK ("quality_state" IN ('valid','poor_quality','unsupported','invalid')),
  "limitations" jsonb NOT NULL,
  "use_mode" text NOT NULL CHECK ("use_mode" IN ('clinical_approved','administrative','shadow','test')),
  "review_state" text NOT NULL CHECK ("review_state" IN ('unreviewed','reviewed','flagged')),
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.a_i_result ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.a_i_result FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.a_i_result USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX a_i_result_updated_idx ON health.a_i_result (tenant_id,updated_at,id);

CREATE TABLE health.agent_plan (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid NOT NULL,
  "encounter_id" uuid NOT NULL,
  "goal_code" text NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('draft','awaiting_review','authorised','running','completed','blocked','cancelled')),
  "steps" jsonb NOT NULL,
  "input_refs" jsonb NOT NULL,
  "plan_hash" text NOT NULL,
  "max_steps" bigint NOT NULL CHECK ("max_steps" >= 1),
  "deadline_at" timestamptz NOT NULL,
  "budget_minor" bigint NOT NULL CHECK ("budget_minor" >= 0),
  "currency" text NOT NULL,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.agent_plan ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.agent_plan FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.agent_plan USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX agent_plan_updated_idx ON health.agent_plan (tenant_id,updated_at,id);

CREATE TABLE health.action_approval (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "plan_id" uuid NOT NULL,
  "action_ids" jsonb NOT NULL,
  "snapshot_hash" text NOT NULL,
  "purpose" text NOT NULL,
  "recipient_ids" jsonb NOT NULL,
  "approver_id" uuid NOT NULL,
  "approved_at" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('active','stale','revoked','expired')),
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.action_approval ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.action_approval FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.action_approval USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX action_approval_updated_idx ON health.action_approval (tenant_id,updated_at,id);

CREATE TABLE health.connector (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "connector_key" text NOT NULL,
  "connector_type" text NOT NULL CHECK ("connector_type" IN ('programme','ehr','abdm_hip','abdm_hiu','abha','legacy','aggregate')),
  "profile_version" text NOT NULL,
  "supported_operations" jsonb NOT NULL,
  "supported_resources" jsonb NOT NULL,
  "mapping_version" text NOT NULL,
  "external_schema_version" text NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('candidate','contract_verified','sandbox_verified','production_onboarded','live','paused','retired')),
  "receipt_semantics_ref" text NOT NULL,
  "owner_ref" text NOT NULL,
  "secret_ref" text NOT NULL,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.connector ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.connector FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.connector USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX connector_updated_idx ON health.connector (tenant_id,updated_at,id);

CREATE TABLE health.submission (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid NOT NULL,
  "encounter_id" uuid NOT NULL,
  "connector_id" uuid NOT NULL,
  "logical_action_id" uuid NOT NULL,
  "payload_ref" text NOT NULL,
  "payload_hash" text NOT NULL,
  "mapping_version" text NOT NULL,
  "source_refs" jsonb NOT NULL,
  "authority_id" uuid NOT NULL,
  "approval_id" uuid NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('prepared','authorised','queued','sent','accepted','rejected','uncertain','cancelled')),
  "destination_receipt_ref" text,
  "destination_version" text,
  "last_error_code" text,
  "attempt_count" bigint NOT NULL CHECK ("attempt_count" >= 0),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,connector_id,logical_action_id)
);

ALTER TABLE health.submission ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.submission FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.submission USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX submission_updated_idx ON health.submission (tenant_id,updated_at,id);

CREATE TABLE health.exchange (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid NOT NULL,
  "connector_id" uuid NOT NULL,
  "role" text NOT NULL CHECK ("role" IN ('hip','hiu')),
  "authority_id" uuid NOT NULL,
  "external_transaction_ref" text,
  "data_types" jsonb NOT NULL,
  "date_from" timestamptz NOT NULL,
  "date_to" timestamptz NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('requested','awaiting_consent','authorised','transferring','received','validated','published','denied','expired','revoked','failed','quarantined')),
  "profile_package" text NOT NULL,
  "bundle_refs" jsonb NOT NULL,
  "validation_ref" text,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.exchange ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.exchange FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.exchange USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX exchange_updated_idx ON health.exchange (tenant_id,updated_at,id);

CREATE TABLE health.offline_lease (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "user_id" uuid NOT NULL,
  "device_id" uuid NOT NULL,
  "record_scope_hash" text NOT NULL,
  "allowed_actions" jsonb NOT NULL,
  "policy_version" text NOT NULL,
  "issued_at" timestamptz NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "server_time_anchor" timestamptz NOT NULL,
  "signature_ref" text NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('active','revoked','expired')),
  PRIMARY KEY (tenant_id,id),
  CHECK (expires_at > issued_at)
);

ALTER TABLE health.offline_lease ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.offline_lease FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.offline_lease USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX offline_lease_updated_idx ON health.offline_lease (tenant_id,updated_at,id);

CREATE TABLE health.media_asset (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid NOT NULL,
  "encounter_id" uuid NOT NULL,
  "content_type" text NOT NULL CHECK ("content_type" IN ('audio/wav','audio/webm','image/jpeg','image/png','application/pdf')),
  "byte_size" bigint NOT NULL CHECK ("byte_size" >= 1),
  "sha256" text NOT NULL,
  "object_ref" text NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('reserved','uploaded','scanning','quarantined','available','disposed')),
  "purpose" text NOT NULL,
  "authority_id" uuid NOT NULL,
  "quality_result_ref" text,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.media_asset ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.media_asset FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.media_asset USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX media_asset_updated_idx ON health.media_asset (tenant_id,updated_at,id);

CREATE TABLE health.audit_event (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "actor_id" uuid NOT NULL,
  "action" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" uuid NOT NULL,
  "purpose" text NOT NULL,
  "policy_decision_id" text NOT NULL,
  "outcome" text NOT NULL CHECK ("outcome" IN ('allowed','denied','failed')),
  "correlation_id" uuid NOT NULL,
  "occurred_at" timestamptz NOT NULL,
  "evidence_refs" jsonb NOT NULL,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.audit_event ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.audit_event FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.audit_event USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX audit_event_updated_idx ON health.audit_event (tenant_id,updated_at,id);

CREATE TABLE health.safety_case (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "person_id" uuid,
  "encounter_id" uuid,
  "category" text NOT NULL CHECK ("category" IN ('clinical','wrong_person','privacy','model','system')),
  "severity" text NOT NULL CHECK ("severity" IN ('critical','high','normal')),
  "state" text NOT NULL CHECK ("state" IN ('open','contained','investigating','resolved','closed')),
  "summary" text NOT NULL,
  "owner_ref" text NOT NULL,
  "affected_refs" jsonb NOT NULL,
  "containment_refs" jsonb NOT NULL,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.safety_case ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.safety_case FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.safety_case USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX safety_case_updated_idx ON health.safety_case (tenant_id,updated_at,id);

CREATE TABLE health.support_case (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "category" text NOT NULL,
  "summary" text NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('open','assigned','resolved','closed')),
  "owner_ref" text NOT NULL,
  "diagnostic_refs" jsonb NOT NULL,
  "access_grant_id" uuid,
  "expires_at" timestamptz,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.support_case ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.support_case FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.support_case USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX support_case_updated_idx ON health.support_case (tenant_id,updated_at,id);

CREATE TABLE health.report_definition (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "metric_key" text NOT NULL,
  "definition_version" text NOT NULL,
  "numerator_ref" text NOT NULL,
  "denominator_ref" text NOT NULL,
  "exclusion_ref" text NOT NULL,
  "source_grain" text NOT NULL,
  "suppression_rule_ref" text NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('draft','approved','active','retired')),
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.report_definition ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.report_definition FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.report_definition USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX report_definition_updated_idx ON health.report_definition (tenant_id,updated_at,id);

CREATE TABLE health.export_job (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "purpose" text NOT NULL,
  "scope_hash" text NOT NULL,
  "authority_id" uuid NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('requested','approved','running','available','expired','failed')),
  "format" text NOT NULL CHECK ("format" IN ('csv','json','fhir')),
  "row_count" bigint CHECK ("row_count" >= 0),
  "manifest_ref" text,
  "download_expires_at" timestamptz,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.export_job ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.export_job FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.export_job USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX export_job_updated_idx ON health.export_job (tenant_id,updated_at,id);

CREATE TABLE health.deployment_config (
  id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES health.tenant(id),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  environment text NOT NULL CHECK (environment IN ('synthetic','test','production')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  "config_version" text NOT NULL,
  "pack_refs" jsonb NOT NULL,
  "capability_refs" jsonb NOT NULL,
  "connector_refs" jsonb NOT NULL,
  "language_codes" jsonb NOT NULL,
  "policy_version" text NOT NULL,
  "state" text NOT NULL CHECK ("state" IN ('draft','validated','approved','active','retired')),
  "manifest_hash" text NOT NULL,
  "approval_refs" jsonb NOT NULL,
  PRIMARY KEY (tenant_id,id)
);

ALTER TABLE health.deployment_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.deployment_config FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.deployment_config USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

CREATE INDEX deployment_config_updated_idx ON health.deployment_config (tenant_id,updated_at,id);

ALTER TABLE health.identifier_link ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.household_membership ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.encounter ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.observation ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.observation ADD FOREIGN KEY (tenant_id,encounter_id) REFERENCES health.encounter(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.authority_record ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.task ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.task ADD FOREIGN KEY (tenant_id,encounter_id) REFERENCES health.encounter(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.referral ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.referral ADD FOREIGN KEY (tenant_id,encounter_id) REFERENCES health.encounter(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.referral ADD FOREIGN KEY (tenant_id,authority_id) REFERENCES health.authority_record(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.a_i_request ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.a_i_request ADD FOREIGN KEY (tenant_id,encounter_id) REFERENCES health.encounter(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.a_i_request ADD FOREIGN KEY (tenant_id,capability_id) REFERENCES health.provider_capability(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.a_i_request ADD FOREIGN KEY (tenant_id,authority_id) REFERENCES health.authority_record(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.a_i_request ADD FOREIGN KEY (tenant_id,result_id) REFERENCES health.a_i_result(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.a_i_result ADD FOREIGN KEY (tenant_id,request_id) REFERENCES health.a_i_request(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.agent_plan ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.agent_plan ADD FOREIGN KEY (tenant_id,encounter_id) REFERENCES health.encounter(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.action_approval ADD FOREIGN KEY (tenant_id,plan_id) REFERENCES health.agent_plan(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.submission ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.submission ADD FOREIGN KEY (tenant_id,encounter_id) REFERENCES health.encounter(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.submission ADD FOREIGN KEY (tenant_id,connector_id) REFERENCES health.connector(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.submission ADD FOREIGN KEY (tenant_id,authority_id) REFERENCES health.authority_record(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.submission ADD FOREIGN KEY (tenant_id,approval_id) REFERENCES health.action_approval(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.exchange ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.exchange ADD FOREIGN KEY (tenant_id,connector_id) REFERENCES health.connector(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.exchange ADD FOREIGN KEY (tenant_id,authority_id) REFERENCES health.authority_record(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.media_asset ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.media_asset ADD FOREIGN KEY (tenant_id,encounter_id) REFERENCES health.encounter(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.media_asset ADD FOREIGN KEY (tenant_id,authority_id) REFERENCES health.authority_record(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.safety_case ADD FOREIGN KEY (tenant_id,person_id) REFERENCES health.person(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.safety_case ADD FOREIGN KEY (tenant_id,encounter_id) REFERENCES health.encounter(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE health.export_job ADD FOREIGN KEY (tenant_id,authority_id) REFERENCES health.authority_record(tenant_id,id) DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE health.command_receipt (tenant_id uuid NOT NULL REFERENCES health.tenant(id), actor_id uuid NOT NULL, command_name text NOT NULL, idempotency_key text NOT NULL, request_hash text NOT NULL, receipt jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,actor_id,command_name,idempotency_key));

CREATE TABLE health.outbox (tenant_id uuid NOT NULL REFERENCES health.tenant(id), event_id uuid NOT NULL, event_type text NOT NULL, resource_id uuid NOT NULL, resource_version bigint NOT NULL, envelope jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz, PRIMARY KEY(tenant_id,event_id));

CREATE TABLE health.consumer_receipt (tenant_id uuid NOT NULL REFERENCES health.tenant(id), consumer_name text NOT NULL, event_id uuid NOT NULL, processed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,consumer_name,event_id));

CREATE TABLE health.record_revision (tenant_id uuid NOT NULL REFERENCES health.tenant(id), resource_type text NOT NULL, resource_id uuid NOT NULL, version bigint NOT NULL, body jsonb NOT NULL, reason text, actor_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,resource_type,resource_id,version));

ALTER TABLE health.command_receipt ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.command_receipt FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.command_receipt USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

ALTER TABLE health.outbox ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.outbox FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.outbox USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

ALTER TABLE health.consumer_receipt ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.consumer_receipt FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.consumer_receipt USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

ALTER TABLE health.record_revision ENABLE ROW LEVEL SECURITY;

ALTER TABLE health.record_revision FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_scope ON health.record_revision USING (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid) WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true),'')::uuid);

COMMIT;

-- Patient relationship, purpose and action checks are service policy obligations.

-- Runtime must use SET LOCAL only after verifying session tenant; never accept arbitrary tenant values from request bodies.

-- Grant DML by component in deployment migration; do not grant runtime schema ownership or BYPASSRLS.

-- audit_event and record_revision require append-only runtime grants before any real data is ingested.
