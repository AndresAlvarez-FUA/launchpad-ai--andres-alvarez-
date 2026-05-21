"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { IssueListItem } from "@/types/issue"
import type { IssueSeverity } from "@/types/reconciliation"

type ApiResponse<T> = {
  data: T | null
  error: string | null
}

type SeverityFilter = "all" | IssueSeverity
type StatusFilter = "all" | "pending" | "approved" | "rejected"

const SEVERITY_STYLES: Record<IssueSeverity, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-secondary text-secondary-foreground",
  low: "bg-primary/10 text-primary border-primary/20",
}

const ISSUE_TYPE_LABELS: Record<string, string> = {
  missing_employee: "Missing employee",
  contribution_error: "Contribution error",
  data_quality: "Data quality",
  reconciliation_mismatch: "Reconciliation mismatch",
}

function formatIssueType(issueType: string) {
  return (
    ISSUE_TYPE_LABELS[issueType] ??
    issueType.replace(/_/g, " ")
  )
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export function IssuesPanel() {
  const [issues, setIssues] = useState<IssueListItem[]>([])
  const [selected, setSelected] = useState<IssueListItem | null>(null)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadIssues = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/issues")
      const result: ApiResponse<{ issues: IssueListItem[] }> =
        await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to load issues")
      }

      setIssues(result.data?.issues ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load issues")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadIssues()
  }, [loadIssues])

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesSeverity =
        severityFilter === "all" || issue.severity === severityFilter
      const fixStatus = issue.suggested_fix?.status ?? issue.status
      const matchesStatus =
        statusFilter === "all" || fixStatus === statusFilter

      return matchesSeverity && matchesStatus
    })
  }, [issues, severityFilter, statusFilter])

  async function handleApprove() {
    const fixId = selected?.suggested_fix?.id
    if (!fixId) return

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/issues/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixId }),
      })
      const result: ApiResponse<{ issueId: string }> = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to approve fix")
      }

      setSuccess("Fix approved and applied.")
      setSelected(null)
      await loadIssues()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve fix")
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleReject() {
    const fixId = selected?.suggested_fix?.id
    if (!fixId) return

    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/issues/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixId }),
      })
      const result: ApiResponse<{ issueId: string }> = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to reject fix")
      }

      setSuccess("Fix rejected.")
      setSelected(null)
      await loadIssues()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject fix")
    } finally {
      setIsSubmitting(false)
    }
  }

  const canReview =
    selected?.suggested_fix?.status === "pending" && !isSubmitting

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Issues</h1>
        <p className="text-sm text-muted-foreground">
          Review reconciliation issues and approve or reject suggested fixes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reconciliation issues</CardTitle>
          <CardDescription>
            Filter by severity and fix status. Click a row to view details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="self-center text-xs font-medium text-muted-foreground">
              Severity:
            </span>
            {(["all", "high", "medium", "low"] as const).map((value) => (
              <FilterButton
                key={value}
                active={severityFilter === value}
                onClick={() => setSeverityFilter(value)}
              >
                {value === "all" ? "All" : value}
              </FilterButton>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="self-center text-xs font-medium text-muted-foreground">
              Status:
            </span>
            {(["all", "pending", "approved", "rejected"] as const).map(
              (value) => (
                <FilterButton
                  key={value}
                  active={statusFilter === value}
                  onClick={() => setStatusFilter(value)}
                >
                  {value === "all" ? "All" : value}
                </FilterButton>
              )
            )}
          </div>

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

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading issues…
            </div>
          ) : filteredIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No issues match the current filters.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Issue type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIssues.map((issue) => (
                  <TableRow
                    key={issue.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(issue)}
                  >
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(SEVERITY_STYLES[issue.severity])}
                      >
                        {issue.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatIssueType(issue.issue_type)}</TableCell>
                    <TableCell className="max-w-md whitespace-normal">
                      {issue.description}
                    </TableCell>
                    <TableCell>{issue.employee_id ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{issue.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>Issue details</DialogTitle>
                <DialogDescription>
                  {formatIssueType(selected.issue_type)} —{" "}
                  {selected.employee_id ?? "no employee"}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={cn(SEVERITY_STYLES[selected.severity])}
                  >
                    {selected.severity}
                  </Badge>
                  <Badge variant="secondary">{selected.status}</Badge>
                </div>

                <div>
                  <p className="font-medium text-foreground">Description</p>
                  <p className="text-muted-foreground">{selected.description}</p>
                </div>

                {selected.suggested_fix ? (
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <p className="font-medium text-foreground">Suggested fix</p>
                    <p>
                      <span className="text-muted-foreground">Field: </span>
                      {selected.suggested_fix.field_name}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Before: </span>
                      {selected.suggested_fix.before_value || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">After: </span>
                      {selected.suggested_fix.after_value || "—"}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Reason: </span>
                      {selected.suggested_fix.reason}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    No suggested fix for this issue.
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() => setSelected(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!canReview}
                  onClick={() => void handleReject()}
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Reject Fix
                </Button>
                <Button
                  type="button"
                  disabled={!canReview}
                  onClick={() => void handleApprove()}
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Approve Fix
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
