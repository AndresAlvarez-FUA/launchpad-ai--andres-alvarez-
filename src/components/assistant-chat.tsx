"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ChatMessage } from "@/types/chat"

type ApiResponse<T> = {
  data: T | null
  error: string | null
}

export function AssistantChat() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scrollToBottom = useCallback(() => {
    const container = scrollRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [])

  const loadMessages = useCallback(async () => {
    setIsLoadingHistory(true)
    setError(null)

    try {
      const response = await fetch("/api/assistant/messages")
      const result: ApiResponse<{ messages: ChatMessage[] }> =
        await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to load messages")
      }

      setMessages(result.data?.messages ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load messages"
      )
    } finally {
      setIsLoadingHistory(false)
    }
  }, [])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isThinking, scrollToBottom])

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || isThinking) return

    setInput("")
    setIsThinking(true)
    setError(null)

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      })

      const result: ApiResponse<{
        userMessage: ChatMessage
        assistantMessage: ChatMessage
      }> = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to send message")
      }

      if (result.data) {
        setMessages((current) => [
          ...current,
          result.data!.userMessage,
          result.data!.assistantMessage,
        ])
      }
    } catch (err) {
      setInput(trimmed)
      setError(err instanceof Error ? err.message : "Failed to send message")
    } finally {
      setIsThinking(false)
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-6">
      <div className="mb-4 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask questions about Acme Robotics&apos; 401(k) plan migration
          onboarding.
        </p>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-xl border bg-muted/20 p-4"
      >
        {isLoadingHistory ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading conversation…
          </div>
        ) : messages.length === 0 && !isThinking ? (
          <p className="text-sm text-muted-foreground">
            Start a conversation about plan setup, participants, payroll runs,
            or reconciliation issues.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2 text-sm whitespace-pre-wrap",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border bg-background text-foreground"
                )}
              >
                {message.content}
              </div>
            </div>
          ))
        )}

        {isThinking && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl border bg-background px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Assistant is thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 shrink-0 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <form
        className="mt-4 flex shrink-0 gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSend()
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about onboarding progress…"
          rows={2}
          disabled={isThinking}
          className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <Button type="submit" disabled={isThinking || !input.trim()}>
          {isThinking ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Send
        </Button>
      </form>
    </div>
  )
}
