import { normalizeSuggestedFixes } from "@/lib/issue-fix"
import { createServiceClient } from "@/lib/supabase/server"
import type { IssueListItem, ReconciliationIssueRow } from "@/types/issue"

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from("reconciliation_issues")
      .select(
        `
        id,
        created_at,
        payroll_run_id,
        employee_id,
        issue_type,
        description,
        severity,
        status,
        suggested_fixes (
          id,
          issue_id,
          field_name,
          before_value,
          after_value,
          reason,
          requires_approval,
          status,
          created_at
        )
      `
      )
      .order("created_at", { ascending: false })

    if (error) {
      throw error
    }

    const issues: IssueListItem[] = (data ?? []).map((row) => {
      const issue = row as ReconciliationIssueRow
      const suggested_fix = normalizeSuggestedFixes(issue.suggested_fixes)

      return {
        id: issue.id,
        created_at: issue.created_at,
        payroll_run_id: issue.payroll_run_id,
        employee_id: issue.employee_id,
        issue_type: issue.issue_type,
        description: issue.description,
        severity: issue.severity,
        status: suggested_fix?.status ?? issue.status,
        suggested_fix,
      }
    })

    return Response.json({ data: { issues }, error: null })
  } catch (error) {
    console.error("Issues list error:", error)
    return Response.json(
      { data: null, error: "Failed to load reconciliation issues" },
      { status: 500 }
    )
  }
}
