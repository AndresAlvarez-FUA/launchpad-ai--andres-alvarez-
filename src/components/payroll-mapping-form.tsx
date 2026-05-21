"use client"

import { useRef, useState } from "react"
import { Check, FileUp, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import {
  PAYROLL_SYSTEM_FIELDS,
  type ColumnMapping,
} from "@/types/payroll-mapping"

type ApiResponse<T> = {
  data: T | null
  error: string | null
}

type CsvPayload = {
  fileName: string
  csvText: string
  payrollRunName: string
  payrollRunId: string
}

const PAYROLL_RUN_NAME = "Payroll Run 1"

const SYSTEM_FIELD_LABELS: Record<(typeof PAYROLL_SYSTEM_FIELDS)[number], string> = {
  employee_id: "Employee ID",
  first_name: "First Name",
  last_name: "Last Name",
  gross_pay: "Gross Pay",
  employee_contribution: "Employee Contribution",
  employer_contribution: "Employer Contribution",
  pay_period_start: "Pay Period Start",
  pay_period_end: "Pay Period End",
}

export function PayrollMappingForm() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [csvPayload, setCsvPayload] = useState<CsvPayload | null>(null)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function suggestMappings(payload: CsvPayload) {
    setIsSuggesting(true)
    try {
      const response = await fetch("/api/payroll/suggest-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText: payload.csvText,
          fileName: payload.fileName,
          payrollRunName: payload.payrollRunName,
        }),
      })
      const result = (await response.json()) as ApiResponse<{
        mappings: ColumnMapping[]
      }>

      if (!response.ok || result.error || !result.data) {
        throw new Error(result.error ?? "Failed to suggest mapping")
      }

      setMappings(result.data.mappings)
    } finally {
      setIsSuggesting(false)
    }
  }

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
    setMappings([])

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
          payrollRunName: PAYROLL_RUN_NAME,
          csvText,
        }),
      })
      const uploadResult = (await uploadResponse.json()) as ApiResponse<{
        payrollRunId: string
      }>
      if (!uploadResponse.ok || uploadResult.error || !uploadResult.data?.payrollRunId) {
        throw new Error(uploadResult.error ?? "Failed to log upload")
      }

      const payload: CsvPayload = {
        fileName: selected.name,
        csvText,
        payrollRunName: PAYROLL_RUN_NAME,
        payrollRunId: uploadResult.data.payrollRunId,
      }

      setCsvPayload(payload)
      await suggestMappings(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process upload")
      setCsvPayload(null)
      setMappings([])
    } finally {
      setIsUploading(false)
    }
  }

  function updateMapping(csvColumn: string, systemField: string) {
    setMappings((prev) =>
      prev.map((row) =>
        row.csvColumn === csvColumn
          ? {
              csvColumn,
              systemField: systemField as ColumnMapping["systemField"],
            }
          : row
      )
    )
  }

  async function handleApprove() {
    if (!csvPayload?.payrollRunId || mappings.length === 0) {
      setError("Upload a CSV and review mappings before approving.")
      return
    }

    setIsApproving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/payroll/approve-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payrollRunId: csvPayload.payrollRunId,
          payrollRunName: csvPayload.payrollRunName,
          csvFileName: csvPayload.fileName,
          mappings,
        }),
      })
      const result = (await response.json()) as ApiResponse<{
        saved: number
      }>

      if (!response.ok || result.error || !result.data) {
        throw new Error(result.error ?? "Failed to approve mapping")
      }

      setSuccess(
        `Payroll mapping approved — ${result.data.saved} column${result.data.saved === 1 ? "" : "s"} saved.`
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to approve mapping"
      )
    } finally {
      setIsApproving(false)
    }
  }

  const isBusy = isUploading || isSuggesting

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll Mapping</h1>
        <p className="text-muted-foreground">
          Upload {PAYROLL_RUN_NAME} CSV, review AI-suggested column mappings, and
          approve.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Payroll CSV</CardTitle>
          <CardDescription>
            Upload the CSV for {PAYROLL_RUN_NAME}. Column mapping suggestions run
            automatically after upload.
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
                : "border-border hover:border-primary/50 hover:bg-muted/30",
              isBusy && "pointer-events-none opacity-60"
            )}
          >
            <FileUp className="size-8 text-muted-foreground" />
            {csvPayload ? (
              <div>
                <p className="font-medium">{csvPayload.fileName}</p>
                <p className="text-sm text-muted-foreground">{PAYROLL_RUN_NAME}</p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Drop your payroll CSV here</p>
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

          {isBusy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {isUploading ? "Logging upload…" : "Generating mapping suggestions…"}
              <Sparkles className="size-4" />
            </p>
          )}
        </CardContent>
      </Card>

      {mappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suggested Column Mappings</CardTitle>
            <CardDescription>
              Adjust any mapping before approving. Leave unmapped for columns that
              should not import.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CSV Column</TableHead>
                  <TableHead>Maps To (suggested)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((row) => (
                  <TableRow key={row.csvColumn}>
                    <TableCell className="font-medium">{row.csvColumn}</TableCell>
                    <TableCell>
                      <select
                        value={row.systemField}
                        onChange={(e) =>
                          updateMapping(row.csvColumn, e.target.value)
                        }
                        className="h-8 w-full max-w-xs rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <option value="">— Unmapped —</option>
                        {PAYROLL_SYSTEM_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {SYSTEM_FIELD_LABELS[field]}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Button
              onClick={() => void handleApprove()}
              disabled={isApproving || isBusy}
            >
              {isApproving ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              Approve Mapping
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
