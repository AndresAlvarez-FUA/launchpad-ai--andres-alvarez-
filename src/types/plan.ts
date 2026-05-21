export type Confidence = "high" | "medium" | "low"

export type ExtractedField = {
  value: string
  confidence: Confidence
}

export type PlanExtraction = {
  company_name: ExtractedField
  ein: ExtractedField
  plan_name: ExtractedField
  plan_effective_date: ExtractedField
  eligibility: ExtractedField
  employer_match: ExtractedField
}

export type PlanFormValues = {
  company_name: string
  ein: string
  plan_name: string
  plan_effective_date: string
  eligibility: string
  employer_match: string
}

export const PLAN_FIELDS = [
  { key: "company_name", label: "Company Name" },
  { key: "ein", label: "EIN" },
  { key: "plan_name", label: "Plan Name" },
  { key: "plan_effective_date", label: "Plan Effective Date" },
  { key: "eligibility", label: "Eligibility" },
  { key: "employer_match", label: "Employer Match" },
] as const satisfies ReadonlyArray<{
  key: keyof PlanFormValues
  label: string
}>

export const EMPTY_PLAN_FORM: PlanFormValues = {
  company_name: "",
  ein: "",
  plan_name: "",
  plan_effective_date: "",
  eligibility: "",
  employer_match: "",
}
