import { writeAuditLog } from "@/lib/audit-log"
import { parseParticipantsCsv } from "@/lib/participants-csv"
import { createServiceClient } from "@/lib/supabase/server"
import type { ParticipantRow } from "@/types/participant"

async function readCsvFromRequest(
  request: Request
): Promise<{ csvText: string; fileName: string }> {
  const contentType = request.headers.get("content-type") ?? ""

  if (contentType.includes("application/json")) {
    const body = await request.json()
    const csvText = typeof body.csvText === "string" ? body.csvText : ""
    const fileName =
      typeof body.fileName === "string" ? body.fileName : "participants.csv"

    if (!csvText.trim()) {
      throw new Error("CSV content is required")
    }

    return { csvText, fileName }
  }

  const formData = await request.formData()
  const file = formData.get("file")

  if (!file || !(file instanceof File)) {
    throw new Error("CSV file is required")
  }

  const isCsv =
    file.type === "text/csv" ||
    file.type === "application/vnd.ms-excel" ||
    file.type === "application/octet-stream" ||
    file.name.toLowerCase().endsWith(".csv")

  if (!isCsv) {
    throw new Error("Only CSV files are supported")
  }

  return { csvText: await file.text(), fileName: file.name }
}

export async function POST(request: Request) {
  try {
    const { csvText, fileName } = await readCsvFromRequest(request)
    const participants = parseParticipantsCsv(csvText)

    if (participants.length === 0) {
      return Response.json(
        { data: null, error: "No participant rows found in CSV" },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from("participants")
      .insert(participants)
      .select(
        "id, employee_id, first_name, last_name, email, ssn_last4, hire_date, dob, status, raw_data"
      )

    if (error) {
      throw error
    }

    const imported = (data ?? []) as ParticipantRow[]

    await writeAuditLog({
      actor_type: "system",
      actor_name: "Import Service",
      action: "PARTICIPANTS_IMPORTED",
      entity_type: "participant",
      after_value: {
        fileName,
        importedCount: imported.length,
        employeeIds: imported.map((p) => p.employee_id),
      },
    })

    return Response.json({
      data: { imported: imported.length, participants: imported },
      error: null,
    })
  } catch (error) {
    console.error("Import error:", error)

    if (error instanceof Error) {
      const message = error.message
      if (
        message.includes("Row") ||
        message.includes("CSV") ||
        message.includes("required") ||
        message.includes("supported")
      ) {
        return Response.json({ data: null, error: message }, { status: 400 })
      }
    }

    return Response.json(
      { data: null, error: "Failed to import participants" },
      { status: 500 }
    )
  }
}
