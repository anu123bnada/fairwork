-- Evidence Vault private bucket (module 6). Run by the OWNER in the hosted project's SQL editor, once, AFTER the vault migration
-- (20261027100000_evidence_vault) is approved and applied. It is not run by any script in this repository.
--
-- Design: the bucket is private, size and type limited, and has NO policy for the anon or authenticated roles, so they cannot
-- read, list, write or sign anything. Only the application's server holds the storage service key (ORYQEN_VAULT_STORAGE_SERVICE_KEY),
-- and it only acts after the database has authorised the owner of a document.
begin;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidence-vault', 'evidence-vault', false, 5242880, array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['application/pdf','image/png','image/jpeg','image/webp'];

-- Row level security on storage.objects is enabled by default on hosted projects; make sure it is, and that no policy mentions this bucket.
alter table storage.objects enable row level security;
commit;

-- Checks to run afterwards (all three must hold):
-- 1. select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'evidence-vault';   -- public = false
-- 2. select policyname, roles, cmd, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects'
--      and (coalesce(qual, '') || coalesce(with_check, '')) ilike '%evidence-vault%';                          -- no rows
-- 3. select relrowsecurity from pg_class where oid = 'storage.objects'::regclass;                               -- true
