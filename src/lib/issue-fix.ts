import { createServiceClient } from "@/lib/supabase/server"
import type {
  ApplyFixResult,
  ReconciliationIssueRow,
  SuggestedFixRow,
} from "@/types/issue"
import { PAYROLL_SYSTEM_FIELDS } from "@/types/payroll-mapping"

const PARTICIPANT_COLUMNS = [
  "first_name",
  "last_name",
  "email",
  "ssn_last4",
  "hire_date",
  "dob",
  "status",
] as const

type ParticipantColumn = (typeof PARTICIPANT_COLUMNS)[number]

function isParticipantColumn(field: string): field is ParticipantColumn {
  return PARTICIPANT_COLUMNS.includes(field as ParticipantColumn)
}

function isPayrollField(field: string): boolean {
  return PAYROLL_SYSTEM_FIELDS.includes(
    field as (typeof PAYROLL_SYSTEM_FIELDS)[number]
  )
}

function normalizeSuggestedFixes(
  value: ReconciliationIssueRow["suggested_fixes"]
): SuggestedFixRow | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export async function loadPendingFix(
  fixId: string
): Promise<{ fix: SuggestedFixRow; issue: ReconciliationIssueRow }> {
  const supabase = createServiceClient()

  const { data: fix, error: fixError } = await supabase
    .from("suggested_fixes")
    .select(
      "id, issue_id, field_name, before_value, after_value, reason, requires_approval, status, created_at"
    )
    .eq("id", fixId)
    .single()

  if (fixError || !fix) {
    throw new Error("Suggested fix not found")
  }

  if (fix.status !== "pending") {
    throw new Error("This fix has already been reviewed")
  }

  const { data: issue, error: issueError } = await supabase
    .from("reconciliation_issues")
    .select(
      "id, created_at, payroll_run_id, employee_id, issue_type, description, severity, status"
    )
    .eq("id", fix.issue_id)
    .single()

  if (issueError || !issue) {
    throw new Error("Reconciliation issue not found")
  }

  return { fix: fix as SuggestedFixRow, issue: issue as ReconciliationIssueRow }
}

export async function applySuggestedFix(
  issue: ReconciliationIssueRow,
  fix: SuggestedFixRow
): Promise<ApplyFixResult> {
  const supabase = createServiceClient()
  const employeeId = issue.employee_id?.trim() || fix.after_value.trim()

  if (!employeeId) {
    throw new Error("Cannot apply fix without an employee_id")
  }

  if (isParticipantColumn(fix.field_name)) {
    const { data: existing, error: fetchError } = await supabase
      .from("participants")
      .select("*")
      .eq("employee_id", employeeId)
      .maybeSingle()

    if (fetchError) {
      throw fetchError
    }

    if (!existing) {
      throw new Error(`Participant ${employeeId} not found`)
    }

    const beforeValue = existing[fix.field_name as ParticipantColumn]

    const { error: updateError } = await supabase
      .from("participants")
      .update({ [fix.field_name]: fix.after_value })
      .eq("employee_id", employeeId)

    if (updateError) {
      throw updateError
    }

    return {
      entity_type: "participant",
      entity_id: employeeId,
      field_name: fix.field_name,
      before_value: beforeValue,
      after_value: fix.after_value,
      payroll_run_id: issue.payroll_run_id,
    }
  }

  if (isPayrollField(fix.field_name) || fix.field_name === "employee_id") {
    const { data: existing, error: fetchError } = await supabase
      .from("participants")
      .select("employee_id, raw_data")
      .eq("employee_id", employeeId)
      .maybeSingle()

    if (fetchError) {
      throw fetchError
    }

    if (!existing) {
      throw new Error(`Participant ${employeeId} not found for payroll fix`)
    }

    const raw =
      existing.raw_data && typeof existing.raw_data === "object"
        ? { ...(existing.raw_data as Record<string, unknown>) }
        : {}

    const payroll =
      raw.payroll && typeof raw.payroll === "object"
        ? { ...(raw.payroll as Record<string, unknown>) }
        : {}

    const runData =
      payroll[issue.payroll_run_id] &&
      typeof payroll[issue.payroll_run_id] === "object"
        ? {
            ...(payroll[issue.payroll_run_id] as Record<string, unknown>),
          }
        : {}

    const beforeValue = runData[fix.field_name] ?? fix.before_value

    runData[fix.field_name] = fix.after_value
    payroll[issue.payroll_run_id] = runData
    raw.payroll = payroll

    const { error: updateError } = await supabase
      .from("participants")
      .update({ raw_data: raw })
      .eq("employee_id", employeeId)

    if (updateError) {
      throw updateError
    }

    return {
      entity_type: "payroll_record",
      entity_id: employeeId,
      field_name: fix.field_name,
      before_value: beforeValue,
      after_value: fix.after_value,
      payroll_run_id: issue.payroll_run_id,
    }
  }

  return {
    entity_type: "reconciliation_issue",
    entity_id: issue.id,
    field_name: fix.field_name,
    before_value: fix.before_value,
    after_value: fix.after_value,
    payroll_run_id: issue.payroll_run_id,
  }
}

export { normalizeSuggestedFixes }
