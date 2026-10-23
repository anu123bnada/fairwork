-- OFFLINE OWNER PROCEDURE, NOT a migration or public RPC. Never run unchanged.
-- Fill the NULL values in a private local copy after the runbook's approval/MFA
-- steps. No passwords, JWTs or MFA secrets go in SQL. Transaction rolls back on
-- any failed precondition. Uses existing administrative rights, grants none.
begin;
do $$
declare
  operator_id uuid := null; -- Actual, distinct, provisioned approver profile.
  target_subject uuid := null; -- Actual synthetic authority-operator profile.
  operator_factor uuid := null; -- Verified TOTP factor ID, never its secret.
  subject_factor uuid := null;
  assignment_id uuid := null; -- Fresh UUID, retain in private approval record.
  approval_record text := null; -- Named accountable operator + purpose + approval reference.
  approved_until timestamptz := null; -- At most 7 days; reapproval is explicit.
begin
  if current_user<>'postgres' or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls)) then
    raise exception 'An existing authorized offline administrator is required; do not change role privileges';
  end if;
  if operator_id is null or target_subject is null or operator_id=target_subject or assignment_id is null
    or operator_factor is null or subject_factor is null or char_length(btrim(coalesce(approval_record,''))) not between 20 and 500
    or approved_until is null or approved_until<=transaction_timestamp() or approved_until>transaction_timestamp()+interval '7 days' then
    raise exception 'Complete the distinct identities, verified MFA references, named approval and bounded expiry in a private copy';
  end if;
  if not has_table_privilege(current_user,'auth.mfa_factors','SELECT') then
    raise exception 'Offline identity cannot verify existing MFA factors; stop and obtain a supported administrative path';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_subject::text,0));
  if (select count(*) from private.profiles where id in (operator_id,target_subject) and account_state='active' and deleted_at is null)<>2 then raise exception 'Both approved profiles must be active'; end if;
  if not exists(select 1 from auth.mfa_factors f where f.id=operator_factor and f.user_id=operator_id and f.factor_type='totp' and f.status='verified')
    or not exists(select 1 from auth.mfa_factors f where f.id=subject_factor and f.user_id=target_subject and f.factor_type='totp' and f.status='verified') then
    raise exception 'Both approved identities require verified TOTP enrollment';
  end if;
  if exists(select 1 from private.capability_assignments c where c.subject_id=target_subject and c.capability='authority_operator' and c.revoked_at is null and c.expires_at>transaction_timestamp()) then raise exception 'An active assignment already exists; do not duplicate or extend it silently'; end if;
  insert into private.capability_assignments(id,subject_id,capability,granted_by,purpose,expires_at)
    values(assignment_id,target_subject,'authority_operator',operator_id,approval_record,approved_until);
  insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class)
    values(operator_id,'bootstrap_capability',assignment_id,assignment_id,array['subject_id','capability','granted_by','purpose','expires_at'],'offline_capability_bootstrap','authority');
end;
$$;
commit;
