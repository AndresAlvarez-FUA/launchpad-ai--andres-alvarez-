import Anthropic from "@anthropic-ai/sdk"

import { parseCsvHeaders } from "@/lib/csv-headers"
import type {
  IssueSeverity,
  IssueType,
  ReconciliationIssueResult,
  SuggestedFixResult,
} from "@/types/reconciliation"

const ISSUE_TYPES: IssueType[] = [
  "missing_employee",
  "contribution_error",
  "data_quality",
  "reconciliation_mismatch",
]

const SEVERITIES: IssueSeverity[] = ["high", "medium", "low"]

const DEFAULT_FIELD_BY_ISSUE: Record<IssueType, string> = {
  missing_employee: "employee_id",
  contribution_error: "employee_contribution",
  data_quality: "gross_pay",
  reconciliation_mismatch: "employee_id",
}

type ReconcileContext = {
  csvText: string
  participants: Array<{
    employee_id: string
    first_name: string
    last_name: string
    email: string
    status: string
  }>
  plan: {
    company_name: string
    plan_name: string
    eligibility: string
    employer_match: string
  } | null
  mappings: Array<{ source_column: string; target_field: string }>
}

function parseCsvPreview(csvText: string, maxRows = 25): string {
  const lines = csvText.replace(/^\uFEFF/, "").trim().split(/\r?\n/)
  return lines.slice(0, maxRows + 1).join("\n")
}

function normalizeSuggestedFix(
  raw: Record<string, unknown> | undefined,
  issueType: IssueType
): SuggestedFixResult | undefined {
  if (!raw) return undefined

  const description =
    typeof raw.description === "string" ? raw.description.trim() : ""
  const proposedFix =
    typeof raw.proposed_fix === "string" ? raw.proposed_fix.trim() : ""
  const reason =
    typeof raw.reason === "string"
      ? raw.reason.trim()
      : [description, proposedFix].filter(Boolean).join(" ")

  if (!reason) return undefined

  return {
    field_name:
      typeof raw.field_name === "string" && raw.field_name.trim()
        ? raw.field_name.trim()
        : DEFAULT_FIELD_BY_ISSUE[issueType],
    before_value:
      typeof raw.before_value === "string" ? raw.before_value.trim() : "",
    after_value:
      typeof raw.after_value === "string"
        ? raw.after_value.trim()
        : proposedFix,
    reason,
  }
}

function parseJsonFromText(text: string): ReconciliationIssueResult[] {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonText = fenced ? fenced[1].trim() : trimmed
  const parsed = JSON.parse(jsonText) as
    | { issues?: Array<Record<string, unknown>> }
    | Array<Record<string, unknown>>

  const rows = Array.isArray(parsed) ? parsed : (parsed.issues ?? [])

  return rows
    .map((row) => {
      const issueType = ISSUE_TYPES.includes(row.issue_type as IssueType)
        ? (row.issue_type as IssueType)
        : "data_quality"
      const summary =
        typeof row.summary === "string"
          ? row.summary.trim()
          : typeof row.title === "string"
            ? row.title.trim()
            : ""
      const description =
        typeof row.description === "string" ? row.description.trim() : ""
      const suggestedFix = normalizeSuggestedFix(
        row.suggested_fix as Record<string, unknown> | undefined,
        issueType
      )

      return {
        issue_type: issueType,
        severity: SEVERITIES.includes(row.severity as IssueSeverity)
          ? (row.severity as IssueSeverity)
          : "medium",
        summary,
        description,
        employee_id:
          typeof row.employee_id === "string" ? row.employee_id.trim() : undefined,
        suggested_fix: suggestedFix,
      }
    })
    .filter((issue) => issue.summary || issue.description)
}

function findEmployeeIdColumn(headers: string[]): string | null {
  const aliases = ["employee_id", "employee id", "emp_id", "participant_id"]
  for (const header of headers) {
    if (aliases.includes(header.trim().toLowerCase())) {
      return header
    }
  }
  return headers[0] ?? null
}

function extractEmployeeIds(csvText: string): string[] {
  const headers = parseCsvHeaders(csvText)
  const idColumn = findEmployeeIdColumn(headers)
  if (!idColumn) return []

  const lines = csvText.replace(/^\uFEFF/, "").trim().split(/\r?\n/)
  const headerIndex = lines[0]
    ?.split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""))
    .findIndex((h) => h.toLowerCase() === idColumn.toLowerCase())

  if (headerIndex < 0) return []

  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
    return cells[headerIndex] ?? ""
  }).filter(Boolean)
}

function reconcileWithHeuristics(context: ReconcileContext): ReconciliationIssueResult[] {
  const payrollIds = new Set(extractEmployeeIds(context.csvText))
  const participantIds = new Set(
    context.participants.map((p) => p.employee_id)
  )
  const issues: ReconciliationIssueResult[] = []

  for (const id of payrollIds) {
    if (!participantIds.has(id)) {
      issues.push({
        issue_type: "missing_employee",
        severity: "high",
        summary: `Employee ${id} not in participant roster`,
        description: `Payroll row references employee_id ${id} which was not found in participants.`,
        employee_id: id,
        suggested_fix: {
          field_name: "employee_id",
          before_value: id,
          after_value: id,
          reason: `Verify employee_id ${id} in the payroll CSV or add the employee to participants.`,
        },
      })
    }
  }

  for (const id of participantIds) {
    if (
      !payrollIds.has(id) &&
      context.participants.find((p) => p.employee_id === id)?.status === "active"
    ) {
      issues.push({
        issue_type: "reconciliation_mismatch",
        severity: "medium",
        summary: `Active participant ${id} missing from payroll`,
        description: `Participant ${id} is active but does not appear in this payroll run.`,
        employee_id: id,
        suggested_fix: {
          field_name: "employee_id",
          before_value: "",
          after_value: id,
          reason: `Add a payroll row for employee_id ${id} or mark the participant inactive if they should be excluded.`,
        },
      })
    }
  }

  if (!context.plan) {
    issues.push({
      issue_type: "data_quality",
      severity: "low",
      summary: "No plan rules on file",
      description:
        "Reconciliation ran without plan eligibility or employer match rules.",
      suggested_fix: {
        field_name: "plan_rules",
        before_value: "",
        after_value: "plan_on_file",
        reason:
          "Add a plan record on the Plan Details page before running full rule-based reconciliation.",
      },
    })
  }

  return issues
}

export async function analyzePayrollReconciliation(
  context: ReconcileContext
): Promise<ReconciliationIssueResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return reconcileWithHeuristics(context)
  }

  const prompt = `Analyze this payroll CSV against participant roster and plan rules. Detect issues:
- missing_employee: payroll references unknown employees
- contribution_error: deferral/match amounts likely violate plan rules
- data_quality: invalid dates, amounts, or missing required fields
- reconciliation_mismatch: roster/payroll mismatches

Participants (${context.participants.length}):
${JSON.stringify(context.participants.slice(0, 100), null, 2)}

Plan rules:
${context.plan ? JSON.stringify(context.plan, null, 2) : "No plan on file"}

Approved column mappings for this run:
${JSON.stringify(context.mappings, null, 2)}

Payroll CSV preview:
${parseCsvPreview(context.csvText)}

Return ONLY valid JSON:
{
  "issues": [
    {
      "issue_type": "missing_employee|contribution_error|data_quality|reconciliation_mismatch",
      "severity": "high|medium|low",
      "summary": "short one-line summary (NOT stored as title)",
      "description": "detailed explanation",
      "employee_id": "optional",
      "suggested_fix": {
        "field_name": "system field e.g. employee_contribution",
        "before_value": "current value from payroll or empty",
        "after_value": "corrected value",
        "reason": "why this fix is needed and what to do"
      }
    }
  ]
}

Include suggested_fix for each issue when possible. Be thorough but avoid duplicate issues.`

  try {
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    })

    const textBlock = message.content.find((block) => block.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude")
    }

    const parsed = parseJsonFromText(textBlock.text)
    return parsed.length > 0 ? parsed : reconcileWithHeuristics(context)
  } catch {
    return reconcileWithHeuristics(context)
  }
}
