import { createServiceClient } from "@/lib/supabase/server"

export type AuditActorType = "user" | "agent" | "system"

export type AuditLogInput = {
  actor_type: AuditActorType
  actor_name: string
  action: string
  entity_type?: string
  entity_id?: string
  before_value?: unknown
  after_value?: unknown
  reason?: string
}

export async function writeAuditLog(input: AuditLogInput) {
  const supabase = createServiceClient()

  const { error } = await supabase.from("audit_logs").insert({
    actor_type: input.actor_type,
    actor_name: input.actor_name,
    action: input.action,
    timestamp: new Date().toISOString(),
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    before_value: input.before_value ?? null,
    after_value: input.after_value ?? null,
    reason: input.reason ?? null,
  })

  if (error) {
    throw new Error("Failed to write audit log")
  }
}
