import type { ParticipantRecord } from "@/types/participant"

type CsvFieldKey = keyof Omit<ParticipantRecord, "ssn_last4" | "raw_data">

const HEADER_ALIASES: Record<CsvFieldKey, string[]> = {
  employee_id: [
    "employee_id",
    "employee id",
    "emp_id",
    "emp id",
    "participant_id",
    "participant id",
  ],
  first_name: ["first_name", "first name", "firstname", "fname"],
  last_name: ["last_name", "last name", "lastname", "lname"],
  email: ["email", "email_address", "email address", "e-mail"],
  hire_date: ["hire_date", "hire date", "date_hired", "date hired"],
  dob: ["date_of_birth", "date of birth", "dob", "birth_date", "birthdate"],
  status: ["employment_status", "employment status", "status"],
}

const CSV_COLUMN_LABELS: Record<CsvFieldKey, string> = {
  employee_id: "employee_id",
  first_name: "first_name",
  last_name: "last_name",
  email: "email",
  hire_date: "hire_date",
  dob: "date_of_birth",
  status: "employment_status",
}

const REQUIRED_FIELDS: CsvFieldKey[] = [
  "employee_id",
  "first_name",
  "last_name",
  "email",
]

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let current = ""
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      row.push(current.trim())
      current = ""
    } else if (char === "\n" || (char === "\r" && next === "\n")) {
      row.push(current.trim())
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
      current = ""
      if (char === "\r") i++
    } else if (char !== "\r") {
      current += char
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim())
    if (row.some((cell) => cell.length > 0)) rows.push(row)
  }

  return rows
}

function normalizeHeader(header: string): CsvFieldKey | null {
  const key = header.trim().toLowerCase().replace(/\s+/g, " ")
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(key)) {
      return field as CsvFieldKey
    }
  }
  return null
}

function normalizeDate(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return trimmed

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, month, day, year] = slashMatch
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return trimmed
}

function normalizeStatus(value: string): string {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return "active"

  const statusMap: Record<string, string> = {
    a: "active",
    active: "active",
    i: "inactive",
    inactive: "inactive",
    t: "terminated",
    terminated: "terminated",
    term: "terminated",
    leave: "leave",
    "on leave": "leave",
  }

  return statusMap[normalized] ?? normalized
}

function buildRawData(
  headerRow: string[],
  cells: string[]
): Record<string, string> {
  const rawData: Record<string, string> = {}
  headerRow.forEach((header, colIndex) => {
    const key = header.trim()
    if (key) rawData[key] = cells[colIndex] ?? ""
  })
  return rawData
}

function normalizeRow(
  mapped: Record<string, string>,
  rawData: Record<string, string>,
  rowIndex: number
): ParticipantRecord {
  const employee_id = mapped.employee_id?.trim() ?? ""
  const first_name = mapped.first_name?.trim() ?? ""
  const last_name = mapped.last_name?.trim() ?? ""
  const email = mapped.email?.trim().toLowerCase() ?? ""
  const hire_date = normalizeDate(mapped.hire_date ?? "")
  const dob = normalizeDate(mapped.dob ?? "")
  const status = normalizeStatus(mapped.status ?? "")

  if (!employee_id || !first_name || !last_name || !email) {
    throw new Error(`Row ${rowIndex + 1} is missing required fields`)
  }

  return {
    employee_id,
    first_name,
    last_name,
    email,
    ssn_last4: null,
    hire_date,
    dob,
    status,
    raw_data: rawData,
  }
}

export function parseParticipantsCsv(csvText: string): ParticipantRecord[] {
  const normalizedText = csvText.replace(/^\uFEFF/, "").trim()
  const rows = parseCsvRows(normalizedText)

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row")
  }

  const [headerRow, ...dataRows] = rows
  const columnMap: Array<CsvFieldKey | null> = headerRow.map(normalizeHeader)

  const mappedFields = new Set(columnMap.filter(Boolean))
  const missingFields = REQUIRED_FIELDS.filter((field) => !mappedFields.has(field))

  if (missingFields.length > 0) {
    const labels = missingFields.map((field) => CSV_COLUMN_LABELS[field])
    throw new Error(`CSV is missing required columns: ${labels.join(", ")}`)
  }

  return dataRows.map((cells, index) => {
    const mapped: Record<string, string> = {}
    columnMap.forEach((field, colIndex) => {
      if (field) mapped[field] = cells[colIndex] ?? ""
    })
    const rawData = buildRawData(headerRow, cells)
    return normalizeRow(mapped, rawData, index + 1)
  })
}
