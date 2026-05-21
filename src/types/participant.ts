export type ParticipantRecord = {
  employee_id: string
  first_name: string
  last_name: string
  email: string
  ssn_last4: null
  hire_date: string
  dob: string
  status: string
  raw_data: Record<string, string>
}

export type ParticipantRow = {
  id: string
  employee_id: string
  first_name: string
  last_name: string
  email: string
  ssn_last4: string | null
  hire_date: string
  dob: string
  status: string
  raw_data: Record<string, string>
}
