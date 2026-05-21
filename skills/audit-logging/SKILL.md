# Audit Logging Pattern                                                                   
                                                                                            
  Every meaningful action — by user, agent, or system — writes a row to audit_logs.         
  Fields to always populate: actor_type, actor_name, action, timestamp.
  Fields to populate when relevant: entity_type, entity_id, before_value, after_value,      
  reason.                                                                                   
                                          
  The fix approval flow writes 3 entries:                                                   
  1. FIX_SUGGESTED (actor_type: agent)                                                      
  2. FIX_APPROVED or FIX_REJECTED (actor_type: user)                                        
  3. FIX_APPLIED (actor_type: system) — only if approved                                    
                                                                                            
  Agents never apply fixes directly. They suggest and log. The API route applies after      
  approval.         
  