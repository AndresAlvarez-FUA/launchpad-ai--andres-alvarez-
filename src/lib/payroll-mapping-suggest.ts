import Anthropic from "@anthropic-ai/sdk"

import { parseCsvHeaders } from "@/lib/csv-headers"
import {
  PAYROLL_SYSTEM_FIELDS,
  type ColumnMapping,
  type PayrollSystemField,
} from "@/types/payroll-mapping"

const FIELD_ALIASES: Record<PayrollSystemField, string[]> = {
  employee_id: ["employee_id", "employee id", "emp_id", "emp id", "id"],
  first_name: ["first_name", "first name", "firstname", "fname"],
  last_name: ["last_name", "last name", "lastname", "lname"],
  gross_pay: ["gross_pay", "gross pay", "gross", "gross wages", "total pay"],
  employee_contribution: [
    "employee_contribution",
    "employee contribution",
    "ee contribution",
    "deferral",
    "employee deferral",
  ],
  employer_contribution: [
    "employer_contribution",
    "employer contribution",
    "er contribution",
    "match",
    "employer match",
  ],
  pay_period_start: [
    "pay_period_start",
    "pay period start",
    "period start",
    "start date",
    "pay start",
  ],
  pay_period_end: [
    "pay_period_end",
    "pay period end",
    "period end",
    "end date",
    "pay end",
  ],
}

function parseJsonFromText(text: string): ColumnMapping[] {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonText = fenced ? fenced[1].trim() : trimmed
  const parsed = JSON.parse(jsonText) as
    | Array<{ csv_column?: string; csvColumn?: string; system_field?: string; systemField?: string }>
    | { mappings?: Array<{ csv_column?: string; csvColumn?: string; system_field?: string; systemField?: string }> }

  const rows = Array.isArray(parsed) ? parsed : (parsed.mappings ?? [])

  return rows
    .map((row): ColumnMapping => {
      const csvColumn = (row.csv_column ?? row.csvColumn ?? "").trim()
      const rawField = (row.system_field ?? row.systemField ?? "").trim()
      const systemField: ColumnMapping["systemField"] =
        PAYROLL_SYSTEM_FIELDS.includes(rawField as PayrollSystemField)
          ? (rawField as PayrollSystemField)
          : ""
      return { csvColumn, systemField }
    })
    .filter((row) => row.csvColumn.length > 0)
}

function suggestWithHeuristics(headers: string[]): ColumnMapping[] {
  const usedFields = new Set<PayrollSystemField>()

  return headers.map((header) => {
    const key = header.trim().toLowerCase().replace(/\s+/g, " ")

    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      const systemField = field as PayrollSystemField
      if (usedFields.has(systemField)) continue
      if (aliases.includes(key)) {
        usedFields.add(systemField)
        return { csvColumn: header, systemField }
      }
    }

    return { csvColumn: header, systemField: "" }
  })
}

function mergeSuggestions(
  headers: string[],
  suggested: ColumnMapping[]
): ColumnMapping[] {
  const byColumn = new Map(
    suggested.map((row) => [row.csvColumn.toLowerCase(), row])
  )

  return headers.map((header) => {
    const match = byColumn.get(header.toLowerCase())
    if (match) return { csvColumn: header, systemField: match.systemField }
    return { csvColumn: header, systemField: "" }
  })
}

export async function suggestPayrollMappings(
  csvText: string
): Promise<ColumnMapping[]> {
  const headers = parseCsvHeaders(csvText)

  if (headers.length === 0) {
    throw new Error("CSV must include a header row")
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return suggestWithHeuristics(headers)
  }

  const prompt = `You are mapping payroll CSV columns to system fields.

CSV headers:
${JSON.stringify(headers)}

System fields (use exactly these values, or empty string if no match):
${JSON.stringify([...PAYROLL_SYSTEM_FIELDS])}

Return ONLY valid JSON — an array with one object per CSV header:
[
  { "csv_column": "<exact header from list>", "system_field": "<system field or empty string>" }
]

Rules:
- Include every CSV header exactly once
- Use each system field at most once
- Use empty string for system_field when a column should not map`

  try {
    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    })

    const textBlock = message.content.find((block) => block.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude")
    }

    const parsed = parseJsonFromText(textBlock.text)
    return mergeSuggestions(headers, parsed)
  } catch {
    return suggestWithHeuristics(headers)
  }
}
