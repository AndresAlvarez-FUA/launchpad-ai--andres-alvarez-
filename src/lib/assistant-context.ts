import { createServiceClient } from "@/lib/supabase/server"
import type { AssistantContext } from "@/types/chat"

export async function fetchAssistantContext(): Promise<AssistantContext> {
  const supabase = createServiceClient()

  const [
    { data: plan, error: planError },
    { count: participantCount, error: participantsError },
    { data: payrollRuns, error: payrollError },
    { data: auditLogs, error: auditError },
  ] = await Promise.all([
    supabase
      .from("plans")
      .select(
        "company_name, plan_name, ein, plan_effective_date, eligibility, employer_match"
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("participants").select("id", { count: "exact", head: true }),
    supabase
      .from("payroll_runs")
      .select("id, run_number, filename, status, row_count, created_at")
      .order("run_number", { ascending: true }),
    supabase
      .from("audit_logs")
      .select("timestamp, actor_type, actor_name, action, entity_type, reason")
      .order("timestamp", { ascending: false })
      .limit(10),
  ])

  if (planError) throw planError
  if (participantsError) throw participantsError
  if (payrollError) throw payrollError
  if (auditError) throw auditError

  return {
    plan: plan ?? null,
    participantCount: participantCount ?? 0,
    payrollRuns: payrollRuns ?? [],
    recentAuditLogs: auditLogs ?? [],
  }
}
