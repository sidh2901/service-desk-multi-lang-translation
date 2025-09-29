import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { User } from '@supabase/supabase-js'
import Login from './components/Login'
import TwilioCallerDashboard from './components/TwilioCallerDashboard'
import TwilioAgentDashboard from './components/TwilioAgentDashboard'
import { Toaster } from './components/ui/toaster'
import { useToast } from './hooks/use-toast'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<'caller' | 'agent' | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserRole(session.user.id, session.user.email || '')
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserRole(session.user.id, session.user.email || '')
      } else {
        setUserRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserRole = async (userId: string, userEmail: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        // Handle invalid session errors by signing out
        if (error.message && (error.message.includes('session_not_found') || error.message.includes('JWT'))) {
          console.log('Invalid session detected, signing out...')
          await supabase.auth.signOut()
          return
        }
        throw error
      } else if (!data) {
        // If no profile exists, create a default one
        const defaultRole = userEmail.includes('agent') ? 'agent' : 'caller'
        const defaultName = userEmail.split('@')[0]
        
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: userEmail,
            role: defaultRole,
            name: defaultName,
            language: 'english'
          })
          .select('role')
          .single()

        if (createError) throw createError
        setUserRole(newProfile.role)
        
        toast({
          title: "Profile Created",
          description: `Welcome! Your profile has been set up as a ${defaultRole}.`
        })
      } else {
        setUserRole(data.role)
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
      toast({
        title: "Error",
        description: "Failed to load user profile. Please try refreshing the page.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <>
      <Routes>
        <Route 
          path="/" 
          element={
            userRole === 'caller' ? <Navigate to="/caller" replace /> :
            userRole === 'agent' ? <Navigate to="/agent" replace /> :
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/caller" 
          element={userRole === 'caller' ? <TwilioCallerDashboard /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/agent" 
          element={userRole === 'agent' ? <TwilioAgentDashboard /> : <Navigate to="/" replace />} 
        />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App