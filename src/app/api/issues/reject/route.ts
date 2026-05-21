import { writeAuditLog } from "@/lib/audit-log"
import { loadPendingFix } from "@/lib/issue-fix"
import { createServiceClient } from "@/lib/supabase/server"

const REJECTED_BY = "Plan Admin"

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

    const { data: updatedFix, error: rejectError } = await supabase
      .from("suggested_fixes")
      .update({ status: "rejected" })
      .eq("id", fixId)
      .select(
        "id, issue_id, field_name, before_value, after_value, reason, status"
      )
      .single()

    if (rejectError) {
      throw rejectError
    }

    const { error: issueUpdateError } = await supabase
      .from("reconciliation_issues")
      .update({ status: "rejected" })
      .eq("id", issue.id)

    if (issueUpdateError) {
      throw issueUpdateError
    }

    await writeAuditLog({
      actor_type: "user",
      actor_name: REJECTED_BY,
      action: "FIX_REJECTED",
      entity_type: "suggested_fix",
      entity_id: fixId,
      before_value: { status: fix.status },
      after_value: { status: "rejected", issueId: issue.id },
      reason: fix.reason,
    })

    return Response.json({
      data: {
        fix: updatedFix,
        issueId: issue.id,
        issueStatus: "rejected",
      },
      error: null,
    })
  } catch (error) {
    console.error("Reject fix error:", error)

    if (error instanceof Error) {
      const message = error.message
      if (
        message.includes("not found") ||
        message.includes("already been reviewed") ||
        message.includes("required")
      ) {
        return Response.json({ data: null, error: message }, { status: 400 })
      }
    }

    return Response.json(
      { data: null, error: "Failed to reject suggested fix" },
      { status: 500 }
    )
  }
}
