import { z } from 'zod';
import { bindAccessPolicy, normallyAllowed } from './access.js';
import { fail } from './core.js';
import { PROGRAMME_NAMES } from './purpose-scope.js';
const location = z.object({ facilityId: z.string().optional(), localityId: z.string().optional() }).passthrough();
const policy = z.object({
    accessScope: z.object({
        enforceFacility: z.boolean(), enforceLocality: z.boolean(),
        facilities: z.array(z.object({ id: z.string(), localityId: z.string().nullish() }).passthrough()),
        teamAssignments: z.record(location), memberAssignments: z.record(location),
    }).passthrough().nullish(),
    purposeGrants: z.array(z.object({
        memberId: z.string(), programme: z.enum(PROGRAMME_NAMES).nullish(), revokedAt: z.string().nullish(),
    }).passthrough()).nullish(),
});
// Final disclosure checkpoint for these ASHA routes only. A single consistent
// read batch supplies current scope; evaluation and response preparation after it
// are synchronous. No transition hydration, second audit or clinical data read.
// This guards its database snapshot, not revocations after that snapshot.
export async function assertAssignedRead(database, auditedMember, organisationId, selection, visit) {
    const person = 'personId' in selection;
    const patientQuery = `SELECT id,team_id,assigned_to,json_extract(data,'$.programmes') AS programmes,
    json_type(data,'$.programmes') AS programmes_type,json_extract(data,'$.facilityId') AS facility_id,
    json_extract(data,'$.localityId') AS locality_id,
    CASE WHEN json_type(data,'$.mergedInto') IS NOT NULL AND json_type(data,'$.mergedInto')!='null' THEN 1 ELSE 0 END AS merged
    FROM patients WHERE org_id=? AND ${person ? 'id=?' : 'assigned_to=?'} ORDER BY id`;
    const statements = [
        database.prepare('SELECT id FROM organisations WHERE id=?').bind(organisationId),
        database.prepare('SELECT role,status,version,is_owner FROM memberships WHERE org_id=? AND user_id=?').bind(organisationId, auditedMember.userId),
        database.prepare('SELECT team_id FROM team_members WHERE org_id=? AND user_id=? ORDER BY team_id').bind(organisationId, auditedMember.userId),
        database.prepare("SELECT json_type(data) AS root_type,json_object('accessScope',json_extract(data,'$.accessScope'),'purposeGrants',json_extract(data,'$.purposeGrants')) AS data FROM operations WHERE org_id=?").bind(organisationId),
        database.prepare(patientQuery).bind(organisationId, person ? selection.personId : auditedMember.userId),
        ...(visit ? [database.prepare("SELECT id,person_id,version,state,json_extract(data,'$.voidedAt') AS voided,json_extract(data,'$.supersededBy') AS superseded FROM visits WHERE org_id=? AND id=?").bind(organisationId, visit.id)] : []),
    ];
    const rows = await database.batch(statements);
    if (!rows[0].results.length)
        fail(404, 'Organisation not found.');
    const membership = rows[1].results[0];
    if (!membership || membership.status !== 'active')
        fail(403, 'Your organisation membership is inactive or unavailable.');
    if (membership.role !== 'asha')
        fail(403, 'An active ASHA membership is required.');
    const stored = rows[3].results[0];
    const parsed = policy.safeParse(stored ? JSON.parse(stored.data) : {});
    if ((stored && stored.root_type !== 'object') || !parsed.success)
        fail(503, 'Current care scope is unavailable.');
    const member = { ...auditedMember, role: membership.role, status: membership.status,
        version: membership.version, isOwner: !!membership.is_owner,
        teamIds: rows[2].results.map(row => row.team_id) };
    bindAccessPolicy({ members: [member], operations: {
            accessScope: (parsed.data.accessScope ?? undefined),
            purposeGrants: (parsed.data.purposeGrants ?? undefined),
        } });
    const eligible = [];
    for (const row of rows[4].results) {
        if (row.programmes_type !== null && !['array', 'null'].includes(row.programmes_type))
            fail(503, 'Current care scope is unavailable.');
        const programmes = row.programmes ? JSON.parse(row.programmes) : [];
        if (!Array.isArray(programmes) || programmes.some(value => typeof value !== 'string'))
            fail(503, 'Current care scope is unavailable.');
        // Only fields used by the shared scope predicate; no name, observations or notes.
        const candidate = { id: row.id, teamId: row.team_id, assignedTo: row.assigned_to,
            programmes, facilityId: row.facility_id ?? undefined, localityId: row.locality_id ?? undefined };
        if (!row.merged && row.assigned_to === member.userId && normallyAllowed(member, candidate))
            eligible.push(row.id);
    }
    const expected = person ? [selection.personId] : [...selection.ids].sort();
    if (eligible.length !== expected.length || eligible.some((id, i) => id !== expected[i]))
        fail(person ? 404 : 409, person ? 'This record is not in your assigned care scope.' : 'Your assigned care scope changed. Refresh Today before continuing.');
    if (visit) {
        const current = rows[5].results[0];
        if (!person || visit.personId !== selection.personId || !current || current.id !== visit.id || current.person_id !== visit.personId)
            fail(404, 'This visit does not belong to the selected person.');
        if (visit.currentDraft && (current.state !== 'draft' || current.voided || current.superseded))
            fail(409, 'The selected routine draft changed. Refresh before continuing.');
        if (visit.minimumVersion !== undefined && (!Number.isSafeInteger(visit.minimumVersion) || visit.minimumVersion < 1 ||
            !Number.isSafeInteger(current.version) || current.version < visit.minimumVersion))
            fail(409, 'The selected routine visit changed. Refresh before continuing.');
    }
}
