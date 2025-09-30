import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { User } from '@supabase/supabase-js'
import Login from './components/Login'
import CallerDashboard from './components/CallerDashboard'
import AgentDashboard from './components/AgentDashboard'
import { Toaster } from './components/ui/toaster'
import { useToast } from './hooks/use-toast'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<'caller' | 'agent' | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.log('Session error detected:', error.message)
        if (error.message && (error.message.includes('session_not_found') || error.message.includes('JWT')) || 
            error.status === 403) {
          supabase.auth.signOut()
          setUser(null)
          setUserRole(null)
          setLoading(false)
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive"
          })
          return
        }
      }
      
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
        if (error.message && (error.message.includes('session_not_found') || error.message.includes('JWT')) ||
            error.code === 'session_not_found' || error.status === 403) {
          console.log('Invalid session detected, signing out...')
          await supabase.auth.signOut()
          setUser(null)
          setUserRole(null)
          setLoading(false)
          toast({
            title: "Session Expired",
            description: "Your session has expired. Please log in again.",
            variant: "destructive"
          })
          return
        }
        throw error
      } else if (!data) {
        // Create default profile with proper demo data
        const defaultRole = userEmail.includes('agent') ? 'agent' : 'caller'
        const defaultName = userEmail === 'agent@demo.com' ? 'Demo Agent' : 
                           userEmail === 'caller@demo.com' ? 'Demo Caller' :
                           userEmail.split('@')[0]
        const defaultLanguage = userEmail === 'agent@demo.com' ? 'spanish' : 'english'
        
        const { data: newProfile, error: createError } = await supabase
          .from('user_profiles')
          .insert({
            id: userId,
            email: userEmail,
            role: defaultRole,
            name: defaultName,
            language: defaultLanguage,
            is_available: defaultRole === 'agent' ? true : null,
            last_seen: defaultRole === 'agent' ? new Date().toISOString() : null
          })
          .select('role')
          .single()

        if (createError) throw createError
        setUserRole(newProfile.role)
        
        toast({
          title: "Profile Created",
          description: `Welcome ${defaultName}! Your profile has been set up as a ${defaultRole}.`
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
            userRole ? <Navigate to="/dashboard" replace /> :
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            userRole === 'caller' ? <CallerDashboard /> :
            userRole === 'agent' ? <AgentDashboard /> :
            <Navigate to="/" replace />
          } 
        />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App