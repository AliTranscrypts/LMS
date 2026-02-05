import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // Track user ID changes to trigger profile fetch outside of onAuthStateChange
  // This prevents the Supabase Web Locks deadlock issue
  const [pendingUserId, setPendingUserId] = useState(null)
  const initialLoadDone = useRef(false)

  // Fetch profile when pendingUserId changes (outside of onAuthStateChange callback)
  useEffect(() => {
    if (pendingUserId) {
      fetchProfile(pendingUserId)
      setPendingUserId(null)
    }
  }, [pendingUserId])

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        // Fetch profile directly on initial load (safe because we're not in onAuthStateChange)
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
      initialLoadDone.current = true
    })

    // Listen for auth changes
    // IMPORTANT: Do NOT make async Supabase calls directly in this callback!
    // Doing so causes a deadlock due to Supabase's Web Locks implementation.
    // Instead, we set pendingUserId and let the useEffect above handle the profile fetch.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] State change:', event)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          // Only trigger profile re-fetch on SIGNED_IN or if profile doesn't match user
          // TOKEN_REFRESHED events don't need profile re-fetch
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            // Queue profile fetch outside this callback to prevent deadlock
            setPendingUserId(session.user.id)
          }
        } else {
          setProfile(null)
          if (initialLoadDone.current) {
            setLoading(false)
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email, password, fullName, role) => {
    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      if (authData.user) {
        // Create the profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            full_name: fullName,
            role: role,
          })
          .select()
          .single()

        if (profileError) throw profileError

        setProfile(profileData)
        return { user: authData.user, profile: profileData, error: null }
      }

      return { user: authData.user, profile: null, error: null }
    } catch (error) {
      console.error('Signup error:', error)
      return { user: null, profile: null, error }
    }
  }

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      return { data, error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { data: null, error }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setProfile(null)
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const value = {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    isTeacher: profile?.role === 'teacher',
    isStudent: profile?.role === 'student',
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
