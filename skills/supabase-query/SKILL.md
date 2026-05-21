# Supabase Query Pattern                                                                  
                                                                                            
  Always use the service role key in API routes (server-side only).                         
  Always check for `error` in the response before using `data`.
  Use `.select("*")` only when you need all columns — be specific when possible.
  For inserts that need the returned row, chain `.select().single()`.   