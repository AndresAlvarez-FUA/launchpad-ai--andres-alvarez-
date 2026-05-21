import { writeAuditLog } from "@/lib/audit-log"
import { suggestPayrollMappings } from "@/lib/payroll-mapping-suggest"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const csvText = typeof body.csvText === "string" ? body.csvText : ""
    const fileName =
      typeof body.fileName === "string" ? body.fileName : "payroll.csv"
    const payrollRunName =
      typeof body.payrollRunName === "string" ? body.payrollRunName : "Payroll Run 1"

    if (!csvText.trim()) {
      return Response.json(
        { data: null, error: "CSV content is required" },
        { status: 400 }
      )
    }

    const mappings = await suggestPayrollMappings(csvText)

    await writeAuditLog({
      actor_type: "agent",
      actor_name: "Claude",
      action: "PAYROLL_MAPPING_SUGGESTED",
      entity_type: "payroll_mapping",
      after_value: {
        fileName,
        payrollRunName,
        mappings,
      },
      reason: "AI-suggested column mappings from CSV headers",
    })

    return Response.json({
      data: { payrollRunName, fileName, mappings },
      error: null,
    })
  } catch (error) {
    console.error("Suggest mapping error:", error)

    if (error instanceof Error && error.message.includes("CSV")) {
      return Response.json({ data: null, error: error.message }, { status: 400 })
    }

    return Response.json(
      { data: null, error: "Failed to suggest payroll mapping" },
      { status: 500 }
    )
  }
}
