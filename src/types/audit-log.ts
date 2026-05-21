import type { AuditActorType } from "@/lib/audit-log"

export type AuditLogRow = {
  id: string
  timestamp: string
  actor_type: AuditActorType
  actor_name: string
  action: string
  entity_type: string | null
  entity_id: string | null
  reason: string | null
  before_value: unknown
  after_value: unknown
}
