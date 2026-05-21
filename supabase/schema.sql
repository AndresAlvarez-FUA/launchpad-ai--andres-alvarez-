-- Reference schema for LaunchPad AI (run in Supabase SQL editor if tables do not exist)

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  ein text not null,
  plan_name text not null,
  plan_effective_date text not null,
  eligibility text not null,
  employer_match text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  ssn_last4 text,
  hire_date text not null default '',
  dob text not null default '',
  status text not null default 'active',
  raw_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists participants_employee_id_idx on participants (employee_id);

-- payroll_runs (existing in Supabase)
-- columns: id, created_at, run_number, filename, status, row_count

-- payroll_mappings (existing in Supabase — one row per mapped column)
-- columns: id, created_at, payroll_run_id, source_column, target_field, approved_by, approved_at

-- reconciliation_issues (existing in Supabase)
-- columns: id, created_at, payroll_run_id, employee_id, issue_type, description, severity, status

-- suggested_fixes (existing in Supabase)
-- columns: id, issue_id, field_name, before_value, after_value, reason, requires_approval, status, created_at

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('user', 'agent', 'system')),
  actor_name text not null,
  action text not null,
  timestamp timestamptz not null default now(),
  entity_type text,
  entity_id text,
  before_value jsonb,
  after_value jsonb,
  reason text
);
