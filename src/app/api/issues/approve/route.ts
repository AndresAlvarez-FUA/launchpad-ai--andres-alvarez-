import { writeAuditLog } from "@/lib/audit-log"
import { applySuggestedFix, loadPendingFix } from "@/lib/issue-fix"
import { createServiceClient } from "@/lib/supabase/server"

const APPROVED_BY = "Plan Admin"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const fixId = typeof body.fixId === "string" ? body.fixId.trim() : ""

    if (!fixId) {
      return Response.json(
        { data: null, error: "fixId is required" },
        { status: 400 }
      )
    }

    const { fix, issue } = await loadPendingFix(fixId)
    const supabase = createServiceClient()

    const { data: updatedFix, error: approveError } = await supabase
      .from("suggested_fixes")
      .update({ status: "approved" })
      .eq("id", fixId)
      .select(
        "id, issue_id, field_name, before_value, after_value, reason, status"
      )
      .single()

    if (approveError) {
      throw approveError
    }

    await writeAuditLog({
      actor_type: "user",
      actor_name: APPROVED_BY,
      action: "FIX_APPROVED",
      entity_type: "suggested_fix",
      entity_id: fixId,
      before_value: { status: fix.status },
      after_value: { status: "approved", issueId: issue.id },
      reason: fix.reason,
    })

    const applied = await applySuggestedFix(issue, fix)

    const { error: issueUpdateError } = await supabase
      .from("reconciliation_issues")
      .update({ status: "resolved" })
      .eq("id", issue.id)

    if (issueUpdateError) {
      throw issueUpdateError
    }

    await writeAuditLog({
      actor_type: "system",
      actor_name: "Fix Application Service",
      action: "FIX_APPLIED",
      entity_type: applied.entity_type,
      entity_id: applied.entity_id,
      before_value: {
        field_name: applied.field_name,
        value: applied.before_value,
        payroll_run_id: applied.payroll_run_id,
      },
      after_value: {
        field_name: applied.field_name,
        value: applied.after_value,
        payroll_run_id: applied.payroll_run_id,
        issueId: issue.id,
        fixId,
      },
      reason: `Applied approved fix for ${applied.field_name}`,
    })

    return Response.json({
      data: {
        fix: updatedFix,
        issueId: issue.id,
        issueStatus: "resolved",
        applied,
      },
      error: null,
    })
  } catch (error) {
    console.error("Approve fix error:", error)

    if (error instanceof Error) {
      const message = error.message
      if (
        message.includes("not found") ||
        message.includes("already been reviewed") ||
        message.includes("required") ||
        message.includes("Cannot apply")
      ) {
        return Response.json({ data: null, error: message }, { status: 400 })
      }
    }

    return Response.json(
      { data: null, error: "Failed to approve suggested fix" },
      { status: 500 }
    )
  }
}
