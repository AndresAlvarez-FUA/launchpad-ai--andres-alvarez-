# API Endpoint Pattern
                                              
  Every Next.js API route in this project follows this shape:
  1. Validate the request body/params — return 400 with a message if invalid.
  2. Perform the operation (DB query, Claude call, etc.).                                   
  3. Write an audit_log entry for any meaningful action.
  4. Return `Response.json({ data, error: null })` on success.                              
  5. Catch errors — return `Response.json({ data: null, error: message }, { status: 500 })`.
  Never expose raw Supabase or Anthropic errors to the client. 