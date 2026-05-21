import { writeAuditLog } from "@/lib/audit-log"
import { generateAssistantReply } from "@/lib/assistant-chat"
import { createServiceClient } from "@/lib/supabase/server"
import type { ChatMessage } from "@/types/chat"

const USER_NAME = "Plan Admin"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const message = typeof body.message === "string" ? body.message.trim() : ""

    if (!message) {
      return Response.json(
        { data: null, error: "message is required" },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data: history, error: historyError } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .order("created_at", { ascending: true })

    if (historyError) {
      throw historyError
    }

    const { data: userRow, error: userInsertError } = await supabase
      .from("chat_messages")
      .insert({ role: "user", content: message })
      .select("id, role, content, created_at")
      .single()

    if (userInsertError) {
      throw userInsertError
    }

    const assistantContent = await generateAssistantReply(
      message,
      (history ?? []) as ChatMessage[]
    )

    const { data: assistantRow, error: assistantInsertError } = await supabase
      .from("chat_messages")
      .insert({ role: "assistant", content: assistantContent })
      .select("id, role, content, created_at")
      .single()

    if (assistantInsertError) {
      throw assistantInsertError
    }

    await writeAuditLog({
      actor_type: "user",
      actor_name: USER_NAME,
      action: "ASSISTANT_MESSAGE_SENT",
      entity_type: "chat_message",
      entity_id: userRow.id,
      after_value: { preview: message.slice(0, 200) },
    })

    await writeAuditLog({
      actor_type: "agent",
      actor_name: "ForUsAll Assistant",
      action: "ASSISTANT_MESSAGE_RECEIVED",
      entity_type: "chat_message",
      entity_id: assistantRow.id,
      after_value: { preview: assistantContent.slice(0, 200) },
      reason: "Response to onboarding assistant question",
    })

    return Response.json({
      data: {
        userMessage: userRow as ChatMessage,
        assistantMessage: assistantRow as ChatMessage,
      },
      error: null,
    })
  } catch (error) {
    console.error("Assistant chat error:", error)

    if (error instanceof Error && error.message.includes("not configured")) {
      return Response.json(
        { data: null, error: "Assistant is not available right now" },
        { status: 503 }
      )
    }

    return Response.json(
      { data: null, error: "Failed to send message to assistant" },
      { status: 500 }
    )
  }
}
