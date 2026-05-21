import { createServiceClient } from "@/lib/supabase/server"
import type { AuditLogRow } from "@/types/audit-log"

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from("audit_logs")
      .select(
        "id, timestamp, actor_type, actor_name, action, entity_type, entity_id, reason, before_value, after_value"
      )
      .order("timestamp", { ascending: false })

    if (error) {
      throw error
    }

    return Response.json({
      data: { logs: (data ?? []) as AuditLogRow[] },
      error: null,
    })
  } catch (error) {
    console.error("Audit log list error:", error)
    return Response.json(
      { data: null, error: "Failed to load audit logs" },
      { status: 500 }
    )
  }
}
