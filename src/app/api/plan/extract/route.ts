import { writeAuditLog } from "@/lib/audit-log"
import { extractPlanFromPdf } from "@/lib/plan-extract"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return Response.json(
        { data: null, error: "PDF file is required" },
        { status: 400 }
      )
    }

    if (file.type !== "application/pdf") {
      return Response.json(
        { data: null, error: "Only PDF files are supported" },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64Pdf = buffer.toString("base64")
    const extraction = await extractPlanFromPdf(base64Pdf)

    await writeAuditLog({
      actor_type: "agent",
      actor_name: "Claude",
      action: "PLAN_EXTRACTED",
      entity_type: "plan",
      after_value: extraction,
      reason: `Extracted from ${file.name}`,
    })

    return Response.json({ data: extraction, error: null })
  } catch {
    return Response.json(
      { data: null, error: "Failed to extract plan details" },
      { status: 500 }
    )
  }
}
