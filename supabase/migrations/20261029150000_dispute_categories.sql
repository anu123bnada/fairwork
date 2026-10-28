begin;
do $$ begin if current_user<>'postgres' then raise exception 'Offline postgres identity required';end if;end $$;
-- Dispute categories (module 9). The four original reason codes stay; eight categories chosen by the owner are added: incorrect_pay, incorrect_hours, incorrect_duties,
-- incorrect_dates, contract_terms, missing_payment, unfair_termination, other. Two places enforce the list: the check constraint on private.work_cases and the case
-- command's input validation. Both are rewritten from their current definitions (the command lives under api.work_case_command in a fresh chain and under
-- api.work_case_command_before_followups once the follow-up migration has wrapped it), so nothing else in either function changes. Existing cases keep their codes.
do $$
declare con record; fn record; def text; old_list text:='''work_inaccurate'',''evidence_integrity'',''verification_conflict'',''suspected_fraud''';
 new_list text:='''work_inaccurate'',''evidence_integrity'',''verification_conflict'',''suspected_fraud'',''incorrect_pay'',''incorrect_hours'',''incorrect_duties'',''incorrect_dates'',''contract_terms'',''missing_payment'',''unfair_termination'',''other''';
 patched integer:=0;
begin
 for con in select c.conname from pg_constraint c where c.conrelid='private.work_cases'::regclass and c.contype='c' and pg_get_constraintdef(c.oid) like '%suspected_fraud%' loop
  execute format('alter table private.work_cases drop constraint %I',con.conname);
 end loop;
 alter table private.work_cases add constraint work_cases_reason_code_check check(reason_code in ('work_inaccurate','evidence_integrity','verification_conflict','suspected_fraud','incorrect_pay','incorrect_hours','incorrect_duties','incorrect_dates','contract_terms','missing_payment','unfair_termination','other'));
 for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and p.proname in ('work_case_command','work_case_command_before_followups') and pg_get_functiondef(p.oid) like '%'||old_list||'%' loop
  def:=replace(pg_get_functiondef(fn.oid),old_list,new_list);
  if def=pg_get_functiondef(fn.oid) then raise exception 'case command list not patched';end if;
  execute def;patched:=patched+1;
 end loop;
 if patched<>1 then raise exception 'expected to patch exactly one case command definition, patched %',patched;end if;
end $$;
notify pgrst,'reload schema';
commit;
