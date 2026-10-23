-- Read-only. Run only if day1-auth-grant-authority.sql confirms the migration
-- history relation exists. Missing/inaccessible history is a stop condition.
-- Do not inspect statements, insert records, repair, or reset migration history.
select expected.version,
  recorded.version is not null as recorded,
  recorded.name
from (values ('202610070001'), ('202610080001'), ('202610080002'), ('202610090001')) expected(version)
left join supabase_migrations.schema_migrations recorded
  on recorded.version = expected.version
order by expected.version;
