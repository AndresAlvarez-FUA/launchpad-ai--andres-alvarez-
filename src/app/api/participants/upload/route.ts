import { writeAuditLog } from "@/lib/audit-log"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const fileName = typeof body.fileName === "string" ? body.fileName : ""
    const fileSize = typeof body.fileSize === "number" ? body.fileSize : 0

    if (!fileName) {
      return Response.json(
        { data: null, error: "fileName is required" },
        { status: 400 }
      )
    }

    await writeAuditLog({
      actor_type: "user",
      actor_name: "Plan Admin",
      action: "PARTICIPANTS_CSV_UPLOADED",
      entity_type: "participant",
      after_value: { fileName, fileSize },
    })

    return Response.json({ data: { logged: true }, error: null })
  } catch {
    return Response.json(
      { data: null, error: "Failed to log participants upload" },
      { status: 500 }
    )
  }
}
