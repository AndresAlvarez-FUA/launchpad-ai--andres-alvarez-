import Anthropic from "@anthropic-ai/sdk"

import type { PlanExtraction } from "@/types/plan"

const EXTRACTION_PROMPT = `Extract the following fields from this retirement plan PDF document.
Return ONLY valid JSON with no markdown fences or extra text.

Required shape:
{
  "company_name": { "value": "string", "confidence": "high" | "medium" | "low" },
  "ein": { "value": "string", "confidence": "high" | "medium" | "low" },
  "plan_name": { "value": "string", "confidence": "high" | "medium" | "low" },
  "plan_effective_date": { "value": "string", "confidence": "high" | "medium" | "low" },
  "eligibility": { "value": "string", "confidence": "high" | "medium" | "low" },
  "employer_match": { "value": "string", "confidence": "high" | "medium" | "low" }
}

Use an empty string for value when a field cannot be found.
Assign confidence based on how clearly the field appears in the document.`

function parseJsonFromText(text: string): PlanExtraction {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonText = fenced ? fenced[1].trim() : trimmed
  const parsed = JSON.parse(jsonText) as PlanExtraction
  return parsed
}

export async function extractPlanFromPdf(base64Pdf: string): Promise<PlanExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error("Missing Anthropic API key")
  }

  const anthropic = new Anthropic({ apiKey })

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Pdf,
            },
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  })

  const textBlock = message.content.find((block) => block.type === "text")
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude")
  }

  return parseJsonFromText(textBlock.text)
}
