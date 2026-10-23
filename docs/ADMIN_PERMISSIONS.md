# Administrative permission contract

All roles require an active local account, protected assignment, unexpired role and
verified MFA. Sensitive writes require MFA authentication within 10 minutes and an
explicit reason. Identity and role are derived by PostgreSQL, never metadata/email.

| Permission | Owner | Administrator | Support/moderator | Auditor |
|---|---|---|---|---|
| Aggregate dashboard, metadata queues, audit/access reports | Yes | Yes | Yes | Yes |
| User directory/search, organizational membership metadata | Yes | Yes | Yes | Yes |
| Suspend/release an ordinary account restriction | Yes | Yes | No | No |
| Suspend/release organization representative access | Yes, if never a member | Yes, if never a member | No | No |
| Grant/revoke admin roles and domain capabilities | Yes | No | No | No |
| Operational notices, bounded settings | Yes | Yes | No | No |
| Incident/moderation metadata and notes | Yes | Yes | Yes | No |
| Private evidence, organization decisions, case decisions, privacy fulfillment | Separate scoped domain permission and independence checks; no automatic access from admin role |
| Impersonation, raw Auth secrets, hosted service activation, audit deletion | No | No | No | No |

No self-grants, self-suspension or last-owner removal through the UI. An
administrator cannot restrict another privileged account. Lifting an admin
restriction does not reactivate a self-deactivated/deleted account. Existing
records and historical decisions are never erased by account management.

Assignments expire: admin roles at most 90 days; domain capabilities at most seven
days through the owner command. The first-owner bootstrap authorization is a
separate, one-use ten-minute permission; its expiry does not immediately remove
the granted owner role. Grant execution still requires final founder approval.

AI quota changes cannot exceed existing hard ceilings. AI pause never enables a
provider or removes consent/processing-policy checks. Sensitive evidence is absent
from metadata dashboards and audit changes. Evidence access logs identify the
case and authorized actor with the participant/accepted-assignment basis.

An admin/support account involved in a case cannot attach an internal priority
note through the administrative command. Case participants may append responses;
an accepted independent reviewer may respond. Only a currently authorized
participant may appeal a resolved case, and the previous reviewer is excluded
from the linked appeal assignment. Original decisions remain immutable.

Organization appeals retain the original rejection and exclude its reviewer.
Suspension denies current representative access without erasing historical
decisions or independently restoring Passport eligibility. Runtime-event views
require the same role/MFA gate. The server-only telemetry writer has no admin
role, private/API schema usage, business-table access or update/delete permission.
