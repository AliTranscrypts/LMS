import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    },
    global: {
      headers: {
        'x-client-info': 'lms-app'
      }
    },
    db: {
      schema: 'public'
    }
  }
)

// Helper to check if session is valid and refresh if needed
// This is crucial for preventing stale session issues that cause silent API failures
export async function ensureValidSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Session check error:', error)
      return { valid: false, error }
    }
    
    if (!session) {
      console.warn('No active session')
      return { valid: false, error: { message: 'No active session' } }
    }
    
    // Check if token is expired or about to expire (within 5 minutes)
    // Using a larger buffer to prevent edge cases where the token expires mid-request
    const expiresAt = session.expires_at
    const now = Math.floor(Date.now() / 1000)
    const bufferSeconds = 300 // 5 minutes buffer
    
    if (expiresAt && expiresAt - now < bufferSeconds) {
      console.log('Session expiring soon, refreshing...')
      const { data, error: refreshError } = await supabase.auth.refreshSession()
      if (refreshError) {
        console.error('Session refresh failed:', refreshError)
        return { valid: false, error: refreshError }
      }
      console.log('Session refreshed successfully')
      return { valid: true, session: data.session }
    }
    
    // Even if the token looks valid, proactively verify the session is still good
    // by checking if we can get a fresh session from the auth service
    // This helps catch cases where localStorage session is stale
    const { data: freshData, error: freshError } = await supabase.auth.refreshSession()
    if (freshError) {
      // If refresh fails but we have a session that hasn't expired, still try to use it
      // The refresh might fail for various reasons that don't affect the current session
      console.warn('Proactive session refresh failed, using existing session:', freshError)
      return { valid: true, session }
    }
    
    return { valid: true, session: freshData.session || session }
  } catch (err) {
    console.error('Unexpected error in ensureValidSession:', err)
    return { valid: false, error: { message: err.message || 'Session validation failed' } }
  }
}

// Diagnostic function to test Supabase connectivity
export async function testSupabaseConnection() {
  console.log('[Supabase Health Check] Starting...')
  console.log('[Supabase Health Check] URL:', supabaseUrl?.substring(0, 30) + '...')
  
  const results = {
    auth: null,
    database: null,
    timestamp: new Date().toISOString()
  }
  
  // Test 1: Auth service
  try {
    const startAuth = Date.now()
    const { data, error } = await supabase.auth.getSession()
    results.auth = {
      success: !error,
      timeMs: Date.now() - startAuth,
      hasSession: !!data?.session,
      error: error?.message
    }
    console.log('[Supabase Health Check] Auth:', results.auth)
  } catch (e) {
    results.auth = { success: false, error: e.message }
    console.error('[Supabase Health Check] Auth failed:', e)
  }
  
  // Test 2: Database query (simple count on profiles)
  try {
    const startDb = Date.now()
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    results.database = {
      success: !error,
      timeMs: Date.now() - startDb,
      error: error?.message
    }
    console.log('[Supabase Health Check] Database:', results.database)
  } catch (e) {
    results.database = { success: false, error: e.message }
    console.error('[Supabase Health Check] Database failed:', e)
  }
  
  console.log('[Supabase Health Check] Complete:', results)
  return results
}

// Expose for debugging in console
if (typeof window !== 'undefined') {
  window.testSupabaseConnection = testSupabaseConnection
  window.supabase = supabase
  window.debugLMS = {
    supabase,
    testConnection: testSupabaseConnection,
    getEnv: () => ({
      url: import.meta.env.VITE_SUPABASE_URL,
      hasKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY
    })
  }
}

export default supabase
