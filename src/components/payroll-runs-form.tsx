"use client"

import { useRef, useState } from "react"
import { FileUp, Loader2, Play } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ReconcileResponse } from "@/types/reconciliation"

type ApiResponse<T> = {
  data: T | null
  error: string | null
}

type RunPayload = {
  runNumber: number
  fileName: string
  csvText: string
  payrollRunId: string
}

const RUN_OPTIONS = [2, 3, 4, 5] as const

const SEVERITY_STYLES = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-secondary text-secondary-foreground",
  low: "bg-primary/10 text-primary border-primary/20",
}

export function PayrollRunsForm() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [runNumber, setRunNumber] = useState<number>(2)
  const [runPayload, setRunPayload] = useState<RunPayload | null>(null)
  const [summary, setSummary] = useState<ReconcileResponse["summary"] | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isReconciling, setIsReconciling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleFileSelected(selected: File | null) {
    if (!selected) return

    const isCsv =
      selected.type === "text/csv" ||
      selected.type === "application/vnd.ms-excel" ||
      selected.type === "application/octet-stream" ||
      selected.name.toLowerCase().endsWith(".csv")

    if (!isCsv) {
      setError("Please upload a CSV file.")
      return
    }

    setError(null)
    setSuccess(null)
    setSummary(null)

    setIsUploading(true)
    try {
      const csvText = await selected.text()
      if (!csvText.trim()) {
        throw new Error("CSV file is empty.")
      }

      const uploadResponse = await fetch("/api/payroll/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selected.name,
          fileSize: selected.size,
          runNumber,
          payrollRunName: `Payroll Run ${runNumber}`,
          csvText,
        }),
      })
      const uploadResult = (await uploadResponse.json()) as ApiResponse<{
        payrollRunId: string
      }>

      if (!uploadResponse.ok || uploadResult.error || !uploadResult.data?.payrollRunId) {
        throw new Error(uploadResult.error ?? "Failed to upload payroll run")
      }

      setRunPayload({
        runNumber,
        fileName: selected.name,
        csvText,
        payrollRunId: uploadResult.data.payrollRunId,
      })
      setSuccess(`Payroll Run ${runNumber} CSV uploaded.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload payroll run")
      setRunPayload(null)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleReconcile() {
    if (!runPayload) {
      setError("Upload a CSV before running reconciliation.")
      return
    }

    setIsReconciling(true)
    setError(null)
    setSuccess(null)
    setSummary(null)

    try {
      const response = await fetch("/api/payroll/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payrollRunId: runPayload.payrollRunId,
          csvText: runPayload.csvText,
          runNumber: runPayload.runNumber,
        }),
      })
      const result = (await response.json()) as ApiResponse<ReconcileResponse>

      if (!response.ok || result.error || !result.data) {
        throw new Error(result.error ?? "Failed to run reconciliation")
      }

      setSummary(result.data.summary)
      setSuccess(
        `Reconciliation complete — ${result.data.issueCount} issue${result.data.issueCount === 1 ? "" : "s"} found and saved.`
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to run reconciliation"
      )
    } finally {
      setIsReconciling(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll Runs</h1>
        <p className="text-muted-foreground">
          Upload payroll CSV files for runs 2–5 and reconcile against participants
          and plan rules.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Payroll CSV</CardTitle>
          <CardDescription>
            Select the run number and upload the payroll file for that period.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="run-number" className="text-sm font-medium">
              Run number
            </label>
            <select
              id="run-number"
              value={runNumber}
              onChange={(e) => {
                setRunNumber(Number(e.target.value))
                setRunPayload(null)
                setSummary(null)
                setSuccess(null)
              }}
              disabled={isUploading || isReconciling}
              className="h-8 w-full max-w-xs rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-40"
            >
              {RUN_OPTIONS.map((num) => (
                <option key={num} value={num}>
                  Run {num}
                </option>
              ))}
            </select>
          </div>

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
                : "border-border hover:border-primary/50 hover:bg-muted/30",
              (isUploading || isReconciling) && "pointer-events-none opacity-60"
            )}
          >
            <FileUp className="size-8 text-muted-foreground" />
            {runPayload ? (
              <div>
                <p className="font-medium">{runPayload.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  Payroll Run {runPayload.runNumber}
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Drop payroll CSV for Run {runNumber}</p>
                <p className="text-sm text-muted-foreground">or click to browse</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)}
          />

          <Button
            onClick={() => void handleReconcile()}
            disabled={!runPayload || isReconciling || isUploading}
          >
            {isReconciling ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Play />
            )}
            Run Reconciliation
          </Button>

          {isUploading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Uploading payroll CSV…
            </p>
          )}
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Reconciliation Summary</CardTitle>
            <CardDescription>
              Issues saved to reconciliation_issues with pending suggested fixes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Total issues</p>
                <p className="text-2xl font-semibold">{summary.total}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">High</p>
                <p className="flex items-center gap-2 text-2xl font-semibold">
                  {summary.high}
                  <Badge variant="outline" className={SEVERITY_STYLES.high}>
                    high
                  </Badge>
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Medium</p>
                <p className="flex items-center gap-2 text-2xl font-semibold">
                  {summary.medium}
                  <Badge variant="outline" className={SEVERITY_STYLES.medium}>
                    medium
                  </Badge>
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">Low</p>
                <p className="flex items-center gap-2 text-2xl font-semibold">
                  {summary.low}
                  <Badge variant="outline" className={SEVERITY_STYLES.low}>
                    low
                  </Badge>
                </p>
              </div>
            </div>
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
