export function parseCsvHeaders(csvText: string): string[] {
  const normalized = csvText.replace(/^\uFEFF/, "").trim()
  const firstLine = normalized.split(/\r?\n/)[0] ?? ""

  const headers: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < firstLine.length; i++) {
    const char = firstLine[i]
    const next = firstLine[i + 1]

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
      headers.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  if (current.length > 0 || headers.length > 0) {
    headers.push(current.trim())
  }

  return headers.filter((header) => header.length > 0)
}
