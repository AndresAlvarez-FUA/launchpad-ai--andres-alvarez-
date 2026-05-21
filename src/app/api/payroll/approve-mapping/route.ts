import { writeAuditLog } from "@/lib/audit-log"
import { resolvePayrollRunId } from "@/lib/payroll-run"
import { createServiceClient } from "@/lib/supabase/server"
import {
  PAYROLL_SYSTEM_FIELDS,
  type ColumnMapping,
  type PayrollMappingRow,
} from "@/types/payroll-mapping"

const APPROVED_BY = "Plan Admin"

function isValidMappings(value: unknown): value is ColumnMapping[] {
  if (!Array.isArray(value)) return false
  return value.every((row) => {
    if (!row || typeof row !== "object") return false
    const record = row as Record<string, unknown>
    const csvColumn = record.csvColumn
    const systemField = record.systemField
    if (typeof csvColumn !== "string" || !csvColumn.trim()) return false
    if (systemField === "") return true
    return PAYROLL_SYSTEM_FIELDS.includes(
      systemField as (typeof PAYROLL_SYSTEM_FIELDS)[number]
    )
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const payrollRunName =
      typeof body.payrollRunName === "string" ? body.payrollRunName : ""
    const payrollRunId =
      typeof body.payrollRunId === "string" ? body.payrollRunId : undefined
    const csvFileName =
      typeof body.csvFileName === "string" ? body.csvFileName : ""
    const mappings = body.mappings

    if (!payrollRunId) {
      return Response.json(
        { data: null, error: "payrollRunId is required" },
        { status: 400 }
      )
    }

    if (!csvFileName) {
      return Response.json(
        { data: null, error: "csvFileName is required" },
        { status: 400 }
      )
    }

    if (!isValidMappings(mappings)) {
      return Response.json(
        { data: null, error: "Invalid mappings payload" },
        { status: 400 }
      )
    }

    const mappedRows = mappings.filter(
      (row): row is ColumnMapping & { systemField: string } =>
        row.systemField !== ""
    )

    if (mappedRows.length === 0) {
      return Response.json(
        { data: null, error: "At least one column must be mapped before approving" },
        { status: 400 }
      )
    }

    const resolvedPayrollRunId = await resolvePayrollRunId({ payrollRunId })

    const approvedAt = new Date().toISOString()
    const supabase = createServiceClient()

    const insertRows = mappedRows.map((row) => ({
      payroll_run_id: resolvedPayrollRunId,
      source_column: row.csvColumn,
      target_field: row.systemField,
      approved_by: APPROVED_BY,
      approved_at: approvedAt,
    }))

    const { data, error } = await supabase
      .from("payroll_mappings")
      .insert(insertRows)
      .select(
        "id, payroll_run_id, source_column, target_field, approved_by, approved_at, created_at"
      )

    if (error) {
      throw error
    }

    const saved = (data ?? []) as PayrollMappingRow[]

    await writeAuditLog({
      actor_type: "user",
      actor_name: APPROVED_BY,
      action: "PAYROLL_MAPPING_APPROVED",
      entity_type: "payroll_mapping",
      entity_id: resolvedPayrollRunId,
      after_value: {
        csvFileName,
        payrollRunId: resolvedPayrollRunId,
        rowCount: saved.length,
        mappings: saved,
      },
    })

    return Response.json({
      data: { payrollRunId: resolvedPayrollRunId, saved: saved.length, rows: saved },
      error: null,
    })
  } catch (error) {
    console.error("Approve mapping error:", error)

    if (
      error instanceof Error &&
      error.message.includes("payroll run")
    ) {
      return Response.json({ data: null, error: error.message }, { status: 400 })
    }

    return Response.json(
      { data: null, error: "Failed to approve payroll mapping" },
      { status: 500 }
    )
  }
}
