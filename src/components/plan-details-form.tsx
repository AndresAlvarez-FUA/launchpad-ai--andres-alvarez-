"use client"

import { useRef, useState } from "react"
import { FileUp, Loader2, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  EMPTY_PLAN_FORM,
  PLAN_FIELDS,
  type Confidence,
  type PlanExtraction,
  type PlanFormValues,
} from "@/types/plan"

type ApiResponse<T> = {
  data: T | null
  error: string | null
}

function extractionToFormValues(extraction: PlanExtraction): PlanFormValues {
  return {
    company_name: extraction.company_name.value,
    ein: extraction.ein.value,
    plan_name: extraction.plan_name.value,
    plan_effective_date: extraction.plan_effective_date.value,
    eligibility: extraction.eligibility.value,
    employer_match: extraction.employer_match.value,
  }
}

function confidenceBadgeClass(confidence: Confidence) {
  switch (confidence) {
    case "high":
      return "bg-primary/10 text-primary border-primary/20"
    case "medium":
      return "bg-secondary text-secondary-foreground"
    case "low":
      return "bg-destructive/10 text-destructive border-destructive/20"
  }
}

export function PlanDetailsForm() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [formValues, setFormValues] = useState<PlanFormValues>(EMPTY_PLAN_FORM)
  const [confidences, setConfidences] = useState<
    Partial<Record<keyof PlanFormValues, Confidence>>
  >({})
  const [showForm, setShowForm] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleFileSelected(selected: File | null) {
    if (!selected) return

    if (selected.type !== "application/pdf") {
      setError("Please upload a PDF file.")
      return
    }

    setError(null)
    setSuccess(null)
    setFile(selected)
    setShowForm(false)
    setConfidences({})
    setFormValues(EMPTY_PLAN_FORM)

    setIsUploading(true)
    try {
      const response = await fetch("/api/plan/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selected.name,
          fileSize: selected.size,
        }),
      })
      const result = (await response.json()) as ApiResponse<{ logged: boolean }>
      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to log upload")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log upload")
      setFile(null)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleExtract() {
    if (!file) {
      setError("Upload a PDF before extracting.")
      return
    }

    setIsExtracting(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/plan/extract", {
        method: "POST",
        body: formData,
      })
      const result = (await response.json()) as ApiResponse<PlanExtraction>

      if (!response.ok || result.error || !result.data) {
        throw new Error(result.error ?? "Failed to extract plan details")
      }

      setFormValues(extractionToFormValues(result.data))
      setConfidences({
        company_name: result.data.company_name.confidence,
        ein: result.data.ein.confidence,
        plan_name: result.data.plan_name.confidence,
        plan_effective_date: result.data.plan_effective_date.confidence,
        eligibility: result.data.eligibility.confidence,
        employer_match: result.data.employer_match.confidence,
      })
      setShowForm(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to extract plan details"
      )
    } finally {
      setIsExtracting(false)
    }
  }

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/plan/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      })
      const result = (await response.json()) as ApiResponse<{ id: string }>

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to save plan")
      }

      setSuccess("Plan saved successfully.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save plan")
    } finally {
      setIsSaving(false)
    }
  }

  function updateField(key: keyof PlanFormValues, value: string) {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan Details</h1>
        <p className="text-muted-foreground">
          Upload a plan PDF, extract fields with AI, review, and save to Supabase.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Plan PDF</CardTitle>
          <CardDescription>
            Drag and drop a PDF or click to browse. Only PDF files are supported.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click()
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              const dropped = e.dataTransfer.files[0]
              void handleFileSelected(dropped ?? null)
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/30"
            )}
          >
            <FileUp className="size-8 text-muted-foreground" />
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Drop your plan PDF here</p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
          />

          <Button
            onClick={() => void handleExtract()}
            disabled={!file || isExtracting || isUploading}
          >
            {isExtracting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            Extract with AI
          </Button>
        </CardContent>
      </Card>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Review Extracted Fields</CardTitle>
            <CardDescription>
              Edit any values before saving. Confidence scores reflect AI certainty.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {PLAN_FIELDS.map(({ key, label }) => {
              const confidence = confidences[key]
              const isLongField = key === "eligibility" || key === "employer_match"

              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor={key} className="text-sm font-medium">
                      {label}
                    </label>
                    {confidence && (
                      <Badge
                        variant="outline"
                        className={confidenceBadgeClass(confidence)}
                      >
                        {confidence}
                      </Badge>
                    )}
                  </div>
                  {isLongField ? (
                    <textarea
                      id={key}
                      value={formValues[key]}
                      onChange={(e) => updateField(key, e.target.value)}
                      rows={3}
                      className="flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  ) : (
                    <Input
                      id={key}
                      value={formValues[key]}
                      onChange={(e) => updateField(key, e.target.value)}
                    />
                  )}
                </div>
              )
            })}

            <Button onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-primary" role="status">
          {success}
        </p>
      )}
    </div>
  )
}
