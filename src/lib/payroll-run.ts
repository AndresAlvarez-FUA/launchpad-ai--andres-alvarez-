import { createServiceClient } from "@/lib/supabase/server"

function parseRunNumber(payrollRunName: string): number {
  const match = payrollRunName.match(/(\d+)/)
  return match ? Number(match[1]) : 1
}

export async function ensurePayrollRun(options: {
  fileName: string
  payrollRunName?: string
  rowCount?: number
}): Promise<string> {
  const supabase = createServiceClient()
  const filename = options.fileName.trim()
  const runNumber = parseRunNumber(options.payrollRunName ?? "Payroll Run 1")

  const { data: existing, error: existingError } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("filename", filename)
    .limit(1)
    .maybeSingle()

  if (existingError) {
    throw existingError
  }

  if (existing?.id) {
    return existing.id
  }

  const { data, error } = await supabase
    .from("payroll_runs")
    .insert({
      run_number: runNumber,
      filename,
      status: "uploaded",
      row_count: options.rowCount ?? 0,
    })
    .select("id")
    .single()

  if (error) {
    throw error
  }

  return data.id
}

export async function resolvePayrollRunId(options: {
  payrollRunId?: string
  payrollRunName?: string
  filename?: string
}): Promise<string> {
  if (options.payrollRunId?.trim()) {
    return options.payrollRunId.trim()
  }

  const supabase = createServiceClient()

  if (options.filename?.trim()) {
    const { data, error } = await supabase
      .from("payroll_runs")
      .select("id")
      .eq("filename", options.filename.trim())
      .limit(1)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (data?.id) {
      return data.id
    }
  }

  const runNumber = parseRunNumber(options.payrollRunName ?? "Payroll Run 1")

  const { data, error } = await supabase
    .from("payroll_runs")
    .select("id")
    .eq("run_number", runNumber)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (data?.id) {
    return data.id
  }

  throw new Error("No payroll run found — upload a CSV first")
}
