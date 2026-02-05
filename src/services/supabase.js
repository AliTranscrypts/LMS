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

// Helper to check if session is valid
export async function ensureValidSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  
  if (error) {
    console.error('Session check error:', error)
    return { valid: false, error }
  }
  
  if (!session) {
    console.warn('No active session')
    return { valid: false, error: { message: 'No active session' } }
  }
  
  // Check if token is expired or about to expire (within 60 seconds)
  const expiresAt = session.expires_at
  const now = Math.floor(Date.now() / 1000)
  
  if (expiresAt && expiresAt - now < 60) {
    console.log('Session expiring soon, refreshing...')
    const { data, error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      console.error('Session refresh failed:', refreshError)
      return { valid: false, error: refreshError }
    }
    return { valid: true, session: data.session }
  }
  
  return { valid: true, session }
}

export default supabase
