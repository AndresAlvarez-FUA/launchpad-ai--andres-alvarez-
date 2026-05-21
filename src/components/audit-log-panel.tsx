"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Search } from "lucide-react"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import type { AuditActorType } from "@/lib/audit-log"
import type { AuditLogRow } from "@/types/audit-log"

type ApiResponse<T> = {
  data: T | null
  error: string | null
}

type ActorFilter = "all" | AuditActorType

const REFRESH_INTERVAL_MS = 30_000

const ACTOR_BADGE_STYLES: Record<AuditActorType, string> = {
  user: "bg-primary/10 text-primary border-primary/20",
  agent: "bg-secondary text-secondary-foreground",
  system: "bg-muted text-muted-foreground border-border",
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "medium",
  })
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "null"
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
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

export function AuditLogPanel() {
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actorFilter, setActorFilter] = useState<ActorFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLogs = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setIsLoading(true)
    }
    setError(null)

    try {
      const response = await fetch("/api/audit-log")
      const result: ApiResponse<{ logs: AuditLogRow[] }> = await response.json()

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Failed to load audit logs")
      }

      setLogs(result.data?.logs ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load audit logs"
      )
    } finally {
      if (!options?.silent) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  useEffect(() => {
    const intervalId = setInterval(() => {
      void loadLogs({ silent: true })
    }, REFRESH_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [loadLogs])

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return logs.filter((log) => {
      const matchesActor =
        actorFilter === "all" || log.actor_type === actorFilter

      if (!matchesActor) return false

      if (!query) return true

      return (
        log.action.toLowerCase().includes(query) ||
        log.actor_name.toLowerCase().includes(query)
      )
    })
  }, [logs, actorFilter, searchQuery])

  function toggleExpanded(id: string) {
    setExpandedId((current) => (current === id ? null : id))
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Activity across the platform. Refreshes every 30 seconds.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Audit entries</CardTitle>
          <CardDescription>
            Click a row to expand before and after values. Filter by actor or
            search by action or actor name.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="self-center text-xs font-medium text-muted-foreground">
              Actor:
            </span>
            {(["all", "user", "agent", "system"] as const).map((value) => (
              <FilterButton
                key={value}
                active={actorFilter === value}
                onClick={() => setActorFilter(value)}
              >
                {value === "all" ? "All" : value}
              </FilterButton>
            ))}
          </div>

          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by action or actor name…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-8"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading audit logs…
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No audit entries match the current filters.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor type</TableHead>
                  <TableHead>Actor name</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity type</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const isExpanded = expandedId === log.id

                  return (
                    <Fragment key={log.id}>
                      <TableRow
                        className="cursor-pointer"
                        data-state={isExpanded ? "expanded" : undefined}
                        onClick={() => toggleExpanded(log.id)}
                      >
                        <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(ACTOR_BADGE_STYLES[log.actor_type])}
                          >
                            {log.actor_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{log.actor_name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.action}
                        </TableCell>
                        <TableCell>{log.entity_type ?? "—"}</TableCell>
                        <TableCell className="max-w-xs whitespace-normal">
                          {log.reason ?? "—"}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30 p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">
                                  before_value
                                </p>
                                <pre className="max-h-64 overflow-auto rounded-md border bg-background p-3 font-mono text-xs">
                                  {formatJson(log.before_value)}
                                </pre>
                              </div>
                              <div>
                                <p className="mb-2 text-xs font-medium text-muted-foreground">
                                  after_value
                                </p>
                                <pre className="max-h-64 overflow-auto rounded-md border bg-background p-3 font-mono text-xs">
                                  {formatJson(log.after_value)}
                                </pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
