import type { IssueSeverity, IssueType } from "@/types/reconciliation"

export type SuggestedFixRow = {
  id: string
  issue_id: string
  field_name: string
  before_value: string
  after_value: string
  reason: string
  requires_approval: boolean
  status: string
  created_at: string
}

export type ReconciliationIssueRow = {
  id: string
  created_at: string
  payroll_run_id: string
  employee_id: string | null
  issue_type: IssueType
  description: string
  severity: IssueSeverity
  status: string
  suggested_fixes: SuggestedFixRow[] | SuggestedFixRow | null
}

export type IssueListItem = {
  id: string
  created_at: string
  payroll_run_id: string
  employee_id: string | null
  issue_type: IssueType
  description: string
  severity: IssueSeverity
  status: string
  suggested_fix: SuggestedFixRow | null
}

export type ApplyFixResult = {
  entity_type: string
  entity_id: string
  field_name: string
  before_value: unknown
  after_value: string
  payroll_run_id: string
}
