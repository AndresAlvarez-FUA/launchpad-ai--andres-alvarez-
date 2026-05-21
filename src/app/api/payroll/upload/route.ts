import { writeAuditLog } from "@/lib/audit-log"
import { ensurePayrollRun } from "@/lib/payroll-run"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const fileName = typeof body.fileName === "string" ? body.fileName : ""
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0
    const payrollRunName =
      typeof body.payrollRunName === "string" ? body.payrollRunName : "Payroll Run 1"
    const csvText = typeof body.csvText === "string" ? body.csvText : ""

    if (!fileName) {
      return Response.json(
        { data: null, error: "fileName is required" },
        { status: 400 }
      )
    }

    const rowCount = csvText.trim()
      ? Math.max(0, csvText.trim().split(/\r?\n/).length - 1)
      : typeof body.rowCount === "number"
        ? body.rowCount
        : 0

    const runNumber =
      typeof body.runNumber === "number" ? body.runNumber : undefined

    const payrollRunId = await ensurePayrollRun({
      fileName,
      runNumber,
      payrollRunName,
      rowCount,
    })

    await writeAuditLog({
      actor_type: "user",
      actor_name: "Plan Admin",
      action: "PAYROLL_CSV_UPLOADED",
      entity_type: "payroll_run",
      entity_id: payrollRunId,
      after_value: { fileName, fileSize, payrollRunName, runNumber, rowCount },
    })

    return Response.json({
      data: { payrollRunId, fileName, rowCount, runNumber: runNumber ?? null },
      error: null,
    })
  } catch (error) {
    console.error("Payroll upload error:", error)
    return Response.json(
      { data: null, error: "Failed to log payroll upload" },
      { status: 500 }
    )
  }
}
