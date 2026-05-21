"use client"

import { useRef, useState } from "react"
import { FileUp, Loader2, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import type { ParticipantRow } from "@/types/participant"

type ApiResponse<T> = {
  data: T | null
  error: string | null
}

type ImportResult = {
  imported: number
  participants: ParticipantRow[]
}

function formatName(participant: ParticipantRow) {
  return `${participant.first_name} ${participant.last_name}`
}

type CsvPayload = {
  fileName: string
  csvText: string
}

export function ParticipantsImport() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [csvPayload, setCsvPayload] = useState<CsvPayload | null>(null)
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleFileSelected(selected: File | null) {
    if (!selected) return

    const isCsv =
      selected.type === "text/csv" ||
      selected.type === "application/vnd.ms-excel" ||
      selected.name.toLowerCase().endsWith(".csv")

    if (!isCsv) {
      setError("Please upload a CSV file.")
      return
    }

    setError(null)
    setSuccess(null)
    setParticipants([])

    setIsUploading(true)
    try {
      const csvText = await selected.text()
      if (!csvText.trim()) {
        throw new Error("CSV file is empty.")
      }

      const payload: CsvPayload = {
        fileName: selected.name,
        csvText,
      }
      setCsvPayload(payload)

      const response = await fetch("/api/participants/upload", {
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
      setCsvPayload(null)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleImport() {
    if (!csvPayload) {
      setError("Upload a CSV before importing.")
      return
    }

    setIsImporting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/participants/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: csvPayload.fileName,
          csvText: csvPayload.csvText,
        }),
      })
      const result = (await response.json()) as ApiResponse<ImportResult>

      if (!response.ok || result.error || !result.data) {
        throw new Error(result.error ?? "Failed to import participants")
      }

      setParticipants(result.data.participants)
      setSuccess(`Imported ${result.data.imported} participants.`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to import participants"
      )
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Participants</h1>
        <p className="text-muted-foreground">
          Upload a CSV of employees, import into Supabase, and review the roster.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Participants CSV</CardTitle>
          <CardDescription>
            Expected columns: employee_id (or participant_id), first_name,
            last_name, email, date_of_birth, hire_date, employment_status
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
            {csvPayload ? (
              <div>
                <p className="font-medium">{csvPayload.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {(csvPayload.csvText.length / 1024).toFixed(1)} KB parsed
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium">Drop your participants CSV here</p>
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
            onClick={() => void handleImport()}
            disabled={!csvPayload || isImporting || isUploading}
          >
            {isImporting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Upload />
            )}
            Import Participants
          </Button>
        </CardContent>
      </Card>

      {participants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Imported Participants</CardTitle>
            <CardDescription>
              {participants.length} record{participants.length === 1 ? "" : "s"}{" "}
              loaded from the latest import.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Hire Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((participant) => (
                  <TableRow key={participant.id}>
                    <TableCell className="font-medium">
                      {formatName(participant)}
                    </TableCell>
                    <TableCell>{participant.employee_id}</TableCell>
                    <TableCell>{participant.email}</TableCell>
                    <TableCell>{participant.hire_date || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {participant.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
