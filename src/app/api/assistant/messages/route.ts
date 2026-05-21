import { createServiceClient } from "@/lib/supabase/server"
import type { ChatMessage } from "@/types/chat"

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .order("created_at", { ascending: true })

    if (error) {
      throw error
    }

    return Response.json({
      data: { messages: (data ?? []) as ChatMessage[] },
      error: null,
    })
  } catch (error) {
    console.error("Chat messages load error:", error)
    return Response.json(
      { data: null, error: "Failed to load chat history" },
      { status: 500 }
    )
  }
}
