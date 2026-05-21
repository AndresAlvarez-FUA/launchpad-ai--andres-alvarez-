import { writeAuditLog } from "@/lib/audit-log"
import { createServiceClient } from "@/lib/supabase/server"
import type { PlanFormValues } from "@/types/plan"

const REQUIRED_FIELDS: (keyof PlanFormValues)[] = [
  "company_name",
  "ein",
  "plan_name",
  "plan_effective_date",
  "eligibility",
  "employer_match",
]

function isValidPlanBody(body: unknown): body is PlanFormValues {
  if (!body || typeof body !== "object") return false
  const record = body as Record<string, unknown>
  return REQUIRED_FIELDS.every(
    (field) => typeof record[field] === "string"
  )
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!isValidPlanBody(body)) {
      return Response.json(
        { data: null, error: "Invalid plan fields" },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from("plans")
      .insert({
        company_name: body.company_name,
        ein: body.ein,
        plan_name: body.plan_name,
        plan_effective_date: body.plan_effective_date,
        eligibility: body.eligibility,
        employer_match: body.employer_match,
      })
      .select(
        "id, company_name, ein, plan_name, plan_effective_date, eligibility, employer_match"
      )
      .single()

    if (error) {
      throw error
    }

    await writeAuditLog({
      actor_type: "user",
      actor_name: "Plan Admin",
      action: "PLAN_SAVED",
      entity_type: "plan",
      entity_id: data.id,
      after_value: data,
    })

    return Response.json({ data, error: null })
  } catch {
    return Response.json(
      { data: null, error: "Failed to save plan" },
      { status: 500 }
    )
  }
}
