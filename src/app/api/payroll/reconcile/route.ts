import { writeAuditLog } from "@/lib/audit-log"
import { analyzePayrollReconciliation } from "@/lib/payroll-reconcile"
import { createServiceClient } from "@/lib/supabase/server"
import type {
  ReconcileResponse,
  ReconciliationIssueResult,
  ReconciliationSummary,
  SuggestedFixResult,
} from "@/types/reconciliation"

function formatIssueDescription(issue: ReconciliationIssueResult): string {
  const summary = issue.summary?.trim()
  const detail = issue.description?.trim()

  if (summary && detail) {
    return `${summary}: ${detail}`
  }

  return summary || detail || "Reconciliation issue detected"
}

function buildSummary(issues: ReconciliationIssueResult[]): ReconciliationSummary {
  return issues.reduce(
    (acc, issue) => {
      acc.total += 1
      acc[issue.severity] += 1
      return acc
    },
    { total: 0, high: 0, medium: 0, low: 0 }
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payrollRunId =
      typeof body.payrollRunId === "string" ? body.payrollRunId : ""
    const csvText = typeof body.csvText === "string" ? body.csvText : ""
    const runNumber =
      typeof body.runNumber === "number" ? body.runNumber : undefined

    if (!payrollRunId) {
      return Response.json(
        { data: null, error: "payrollRunId is required" },
        { status: 400 }
      )
    }

    if (!csvText.trim()) {
      return Response.json(
        { data: null, error: "CSV content is required" },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data: participants, error: participantsError } = await supabase
      .from("participants")
      .select("employee_id, first_name, last_name, email, status")

    if (participantsError) {
      throw participantsError
    }

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("company_name, plan_name, eligibility, employer_match")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (planError) {
      throw planError
    }

    const { data: mappings, error: mappingsError } = await supabase
      .from("payroll_mappings")
      .select("source_column, target_field")
      .eq("payroll_run_id", payrollRunId)

    if (mappingsError) {
      throw mappingsError
    }

    const issues = await analyzePayrollReconciliation({
      csvText,
      participants: participants ?? [],
      plan: plan ?? null,
      mappings: mappings ?? [],
    })

    const summary = buildSummary(issues)
    const savedIssueIds: string[] = []

    for (const issue of issues) {
      const { data: savedIssue, error: issueError } = await supabase
        .from("reconciliation_issues")
        .insert({
          payroll_run_id: payrollRunId,
          employee_id: issue.employee_id ?? null,
          issue_type: issue.issue_type,
          description: formatIssueDescription(issue),
          severity: issue.severity,
          status: "open",
        })
        .select("id")
        .single()

      if (issueError) {
        throw issueError
      }

      savedIssueIds.push(savedIssue.id)

      if (issue.suggested_fix) {
        const fix: SuggestedFixResult = issue.suggested_fix
        const { data: savedFix, error: fixError } = await supabase
          .from("suggested_fixes")
          .insert({
            issue_id: savedIssue.id,
            field_name: fix.field_name,
            before_value: fix.before_value,
            after_value: fix.after_value,
            reason: fix.reason,
            requires_approval: true,
            status: "pending",
          })
          .select("id")
          .single()

        if (fixError) {
          throw fixError
        }

        await writeAuditLog({
          actor_type: "agent",
          actor_name: "Claude",
          action: "FIX_SUGGESTED",
          entity_type: "suggested_fix",
          entity_id: savedFix.id,
          after_value: {
            issueId: savedIssue.id,
            field_name: fix.field_name,
            before_value: fix.before_value,
            after_value: fix.after_value,
          },
          reason: fix.reason,
        })
      }
    }

    await supabase
      .from("payroll_runs")
      .update({ status: "reconciled" })
      .eq("id", payrollRunId)

    await writeAuditLog({
      actor_type: "agent",
      actor_name: "Claude",
      action: "PAYROLL_RECONCILIATION_RUN",
      entity_type: "payroll_run",
      entity_id: payrollRunId,
      after_value: {
        runNumber,
        summary,
        issueCount: issues.length,
        issueIds: savedIssueIds,
      },
      reason: "AI payroll reconciliation against participants and plan rules",
    })

    const response: ReconcileResponse = {
      payrollRunId,
      runNumber: runNumber ?? 0,
      summary,
      issueCount: issues.length,
    }

    return Response.json({ data: response, error: null })
  } catch (error) {
    console.error("Reconcile error:", error)
    return Response.json(
      { data: null, error: "Failed to run payroll reconciliation" },
      { status: 500 }
    )
  }
}
