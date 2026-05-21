export const PAYROLL_SYSTEM_FIELDS = [
  "employee_id",
  "first_name",
  "last_name",
  "gross_pay",
  "employee_contribution",
  "employer_contribution",
  "pay_period_start",
  "pay_period_end",
] as const

export type PayrollSystemField = (typeof PAYROLL_SYSTEM_FIELDS)[number]

export type ColumnMapping = {
  csvColumn: string
  systemField: PayrollSystemField | ""
}

export type PayrollMappingRow = {
  id: string
  payroll_run_id: string
  source_column: string
  target_field: string
  approved_by: string
  approved_at: string
  created_at: string
}
