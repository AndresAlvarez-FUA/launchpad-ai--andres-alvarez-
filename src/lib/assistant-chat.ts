import Anthropic from "@anthropic-ai/sdk"

import { fetchAssistantContext } from "@/lib/assistant-context"
import type { ChatMessage } from "@/types/chat"

const SYSTEM_PROMPT = `You are an onboarding assistant for ForUsAll that helps answer questions about Acme Robotics' 401(k) plan migration.

Use the onboarding context provided below to answer accurately. If the context does not contain enough information, say what is missing and suggest which part of the onboarding workflow the user should complete next (plan details, participants, payroll mapping, payroll runs, issues, or audit log).

Be concise, professional, and focused on retirement plan onboarding tasks. Do not invent plan data that is not in the context.`

const HISTORY_LIMIT = 20

export async function generateAssistantReply(
  userMessage: string,
  history: ChatMessage[]
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("Assistant is not configured")
  }

  const context = await fetchAssistantContext()
  const anthropic = new Anthropic({ apiKey })

  const recentHistory = history.slice(-HISTORY_LIMIT).map((message) => ({
    role: message.role as "user" | "assistant",
    content: message.content,
  }))

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `${SYSTEM_PROMPT}\n\nOnboarding context (JSON):\n${JSON.stringify(context, null, 2)}`,
    messages: [...recentHistory, { role: "user", content: userMessage }],
  })

  const textBlock = message.content.find((block) => block.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No response from assistant")
  }

  return textBlock.text.trim()
}
