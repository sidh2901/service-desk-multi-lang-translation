import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useToast } from '../hooks/use-toast'
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, 
  LogOut, User, Languages, PhoneCall, Clock
} from 'lucide-react'

const LANGUAGES = [
  { code: 'marathi', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'spanish', label: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'english', label: 'English', flag: '🇺🇸' },
  { code: 'hindi', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'french', label: 'Français (French)', flag: '🇫🇷' },
  { code: 'german', label: 'Deutsch (German)', flag: '🇩🇪' },
]

type CallState = 'idle' | 'calling' | 'connected' | 'ended'

interface AgentWithStatus {
  id: string
  name: string
  email: string
  language: string
  role: string
  created_at: string
  is_available: boolean
  last_seen: string
}
export default function CallerDashboard() {
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [availableAgents, setAvailableAgents] = useState<AgentWithStatus[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [callState, setCallState] = useState<CallState>('idle')
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [language, setLanguage] = useState('english')
  const [currentCall, setCurrentCall] = useState<any>(null)

  useEffect(() => {
    fetchUserProfile()
    
    // Start polling for available agents
    const pollInterval = setInterval(fetchAvailableAgents, 3000) // Poll every 3 seconds
    fetchAvailableAgents() // Initial fetch
    
    // Simulate call timer
    let interval: NodeJS.Timeout
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    }
    
    return () => {
      clearInterval(interval)
      clearInterval(pollInterval)
    }
  }, [callState])

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setUser(profile)
          setLanguage(profile.language)
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const fetchAvailableAgents = async () => {
    try {
      const { data: agents, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'agent')

      if (error) throw error
      
      // For now, simulate availability status
      // In a real app, you'd track this in the database with last_seen timestamps
      const agentsWithStatus: AgentWithStatus[] = (agents || []).map(agent => ({
        ...agent,
        is_available: Math.random() > 0.3, // Simulate 70% availability
        last_seen: new Date().toISOString()
      }))
      
      setAvailableAgents(agentsWithStatus)
    } catch (error) {
      console.error('Error fetching agents:', error)
    }
  }

  const startCall = async () => {
    if (!selectedAgent) {
      toast({ 
        title: 'Select agent', 
        description: 'Please select an agent to call',
        variant: 'destructive'
      })
      return
    }

    try {
      setCallState('calling')
      
      // Create call session
      const { data: session, error } = await supabase
        .from('call_sessions')
        .insert({
          caller_id: user.id,
          agent_id: selectedAgent,
          status: 'ringing',
          caller_language: language,
          agent_language: 'english'
        })
        .select()
        .single()

      if (error) throw error

      setCurrentCall(session)
      
      // Simulate call connection
      setTimeout(() => {
        setCallState('connected')
        toast({ title: 'Call connected!', description: 'You are now speaking with an agent' })
      }, 2000)

      toast({ title: 'Calling...', description: 'Connecting to agent' })

    } catch (error: any) {
      toast({ 
        title: 'Call failed', 
        description: error.message,
        variant: 'destructive'
      })
      setCallState('idle')
    }
  }

  const endCall = async () => {
    try {
      if (currentCall) {
        await supabase
          .from('call_sessions')
          .update({ 
            status: 'ended',
            ended_at: new Date().toISOString(),
            duration: callDuration
          })
          .eq('id', currentCall.id)
      }

      setCallState('ended')
      setTimeout(() => {
        setCallState('idle')
        setCurrentCall(null)
        setCallDuration(0)
      }, 2000)

      toast({ title: 'Call ended', description: `Duration: ${formatDuration(callDuration)}` })
    } catch (error: any) {
      console.error('Error ending call:', error)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const getLangInfo = (code: string) => LANGUAGES.find(l => l.code === code)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-600 rounded-lg grid place-items-center font-bold text-white text-lg">
              ASJ
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Caller Dashboard</h1>
              <p className="text-sm text-slate-500">Welcome, {user?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant={callState === 'connected' ? 'default' : 'secondary'} className="px-3 py-1">
              {callState === 'connected' ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                  Connected • {formatDuration(callDuration)}
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-slate-400 rounded-full mr-2" />
                  {callState.charAt(0).toUpperCase() + callState.slice(1)}
                </>
              )}
            </Badge>
            
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Call Control */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Call an Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Agent Selection */}
              {callState === 'idle' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Select Agent</label>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an agent to call" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAgents.filter(agent => agent.is_available).map(agent => (
                          <SelectItem key={agent.id} value={agent.id}>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span>{agent.name}</span>
                              <div className="w-2 h-2 bg-green-500 rounded-full" />
                              <Badge variant="secondary" className="text-xs">
                                {getLangInfo(agent.language)?.flag} {getLangInfo(agent.language)?.label}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                        {availableAgents.filter(agent => agent.is_available).length === 0 && (
                          <SelectItem value="no-agents-available" disabled>
                            No agents available
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1">
                      {availableAgents.filter(agent => agent.is_available).length} of {availableAgents.length} agents available
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Your Language</label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map(lang => (
                          <SelectItem key={lang.code} value={lang.code}>
                            {lang.flag} {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Main Call Button */}
              <div className="text-center">
                <div 
                  className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    callState === 'idle' ? 'bg-green-500 hover:bg-green-600' :
                    callState === 'calling' ? 'bg-blue-500 animate-pulse' :
                    callState === 'connected' ? 'bg-red-500 hover:bg-red-600' :
                    'bg-slate-400'
                  }`}
                  onClick={() => {
                    if (callState === 'idle') startCall()
                    else if (callState === 'connected') endCall()
                  }}
                >
                  {callState === 'idle' && <Phone className="w-8 h-8 text-white" />}
                  {callState === 'calling' && <PhoneCall className="w-8 h-8 text-white" />}
                  {callState === 'connected' && <PhoneOff className="w-8 h-8 text-white" />}
                  {callState === 'ended' && <PhoneOff className="w-8 h-8 text-white" />}
                </div>
                
                <p className="mt-4 text-sm font-medium text-slate-700">
                  {callState === 'idle' && 'Call Agent'}
                  {callState === 'calling' && 'Calling...'}
                  {callState === 'connected' && 'End Call'}
                  {callState === 'ended' && 'Call Ended'}
                </p>

                {callState === 'connected' && (
                  <div className="flex items-center justify-center gap-2 mt-2 text-green-600">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-mono">{formatDuration(callDuration)}</span>
                  </div>
                )}
              </div>

              {/* Call Controls */}
              {callState === 'connected' && (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsMuted(!isMuted)}
                    className={isMuted ? 'bg-red-50 border-red-200' : ''}
                  >
                    {isMuted ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </Button>
                  
                  <Button variant="outline" size="sm" disabled>
                    <Volume2 className="w-4 h-4 mr-2" />
                    Volume
                  </Button>
                </div>
              )}

              {/* Call Info */}
              {currentCall && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Call Information</h4>
                  <div className="space-y-1 text-xs text-blue-700">
                    <p>Session ID: {currentCall.id.slice(-8)}</p>
                    <p>Status: {currentCall.status}</p>
                    <p>Your Language: {getLangInfo(language)?.label}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Features */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                AI Translation Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <Languages className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Auto Language Detection</p>
                    <p className="text-xs text-green-700">AI detects your language automatically</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <PhoneCall className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-purple-900">Real-time Translation</p>
                    <p className="text-xs text-purple-700">Instant voice translation during calls</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Agent Matching</p>
                    <p className="text-xs text-blue-700">Connect with available agents</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border">
                <h4 className="text-sm font-medium text-slate-900 mb-2">🌍 Supported Languages:</h4>
                <div className="grid grid-cols-2 gap-1">
                  {LANGUAGES.map((lang) => (
                    <div key={lang.code} className="flex items-center text-xs">
                      <span className="mr-1">{lang.flag}</span>
                      <span className="truncate">{lang.label.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <h4 className="text-sm font-medium text-green-900 mb-2">✅ How it works:</h4>
                <ol className="text-xs text-green-800 space-y-1">
                  <li>1. Select an available agent</li>
                  <li>2. Choose your preferred language</li>
                  <li>3. Start the call</li>
                  <li>4. AI translates in real-time!</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}