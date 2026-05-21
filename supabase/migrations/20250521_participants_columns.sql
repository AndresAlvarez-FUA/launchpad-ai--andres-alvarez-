-- Run in Supabase SQL editor if import fails with missing column errors

alter table participants add column if not exists raw_data jsonb not null default '{}';
alter table participants alter column ssn_last4 drop not null;
