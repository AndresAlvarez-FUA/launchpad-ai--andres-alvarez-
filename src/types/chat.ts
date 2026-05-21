export type ChatRole = "user" | "assistant"

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  created_at: string
}

export type AssistantContext = {
  plan: {
    company_name: string
    plan_name: string
    ein: string
    plan_effective_date: string
    eligibility: string
    employer_match: string
  } | null
  participantCount: number
  payrollRuns: Array<{
    id: string
    run_number: number
    filename: string
    status: string
    row_count: number
    created_at: string
  }>
  recentAuditLogs: Array<{
    timestamp: string
    actor_type: string
    actor_name: string
    action: string
    entity_type: string | null
    reason: string | null
  }>
}
