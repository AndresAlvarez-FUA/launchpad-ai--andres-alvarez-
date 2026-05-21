export type IssueSeverity = "high" | "medium" | "low"

export type IssueType =
  | "missing_employee"
  | "contribution_error"
  | "data_quality"
  | "reconciliation_mismatch"

export type SuggestedFixResult = {
  field_name: string
  before_value: string
  after_value: string
  reason: string
}

export type ReconciliationIssueResult = {
  issue_type: IssueType
  severity: IssueSeverity
  /** Internal only — merged into description before insert */
  summary?: string
  description: string
  employee_id?: string
  suggested_fix?: SuggestedFixResult & {
    description?: string
    proposed_fix?: string
  }
}

export type ReconciliationSummary = {
  total: number
  high: number
  medium: number
  low: number
}

export type ReconcileResponse = {
  payrollRunId: string
  runNumber: number
  summary: ReconciliationSummary
  issueCount: number
}
