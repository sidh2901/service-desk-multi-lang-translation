import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { startRealtime, RealtimeHandle } from '../lib/realtime'
import { RingToneGenerator, playNotificationSound } from '../lib/audio'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useToast } from '../hooks/use-toast'
import { 
  PhoneIncoming, PhoneOff, Mic, MicOff, Volume2, 
  LogOut, Headphones, Languages, User, UserCheck 
} from 'lucide-react'

const LANGUAGES = [
  { code: 'marathi', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'spanish', label: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'english', label: 'English', flag: '🇺🇸' },
  { code: 'hindi', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'french', label: 'Français (French)', flag: '🇫🇷' },
  { code: 'german', label: 'Deutsch (German)', flag: '🇩🇪' },
]

type CallState = 'idle' | 'incoming' | 'connected' | 'ended'

export default function AgentDashboard() {
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [callState, setCallState] = useState<CallState>('idle')
  const [currentSession, setCurrentSession] = useState<any>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [language, setLanguage] = useState('spanish')
  const [currentSpeech, setCurrentSpeech] = useState('')
  const [currentTranslation, setCurrentTranslation] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isAvailable, setIsAvailable] = useState(true)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const realtimeRef = useRef<RealtimeHandle | null>(null)
  const ringToneRef = useRef<RingToneGenerator | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const debugMessage = `[${timestamp}] ${message}`
    console.log(`🔍 AGENT: ${debugMessage}`)
    setDebugInfo(prev => [...prev.slice(-9), debugMessage])
  }

  useEffect(() => {
    fetchUserProfile()
    ringToneRef.current = new RingToneGenerator()
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (ringToneRef.current) ringToneRef.current.stop()
      if (realtimeRef.current) realtimeRef.current.hangup()
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  useEffect(() => {
    if (user?.id && isAvailable && callState === 'idle') {
      addDebugInfo(`Starting to poll for calls - User: ${user.id}`)
      startPollingForCalls()
    } else {
      addDebugInfo(`Stopping polling - Available: ${isAvailable}, State: ${callState}`)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [user?.id, isAvailable, callState])

  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (callState === 'idle') {
        setCallDuration(0)
      }
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
          addDebugInfo(`Profile loaded - Name: ${profile.name}, Role: ${profile.role}`)
        }
      }
    } catch (error) {
      addDebugInfo(`Error fetching profile: ${error}`)
    }
  }

  const startPollingForCalls = () => {
    if (pollingRef.current) {
      addDebugInfo('Polling already active')
      return
    }

    addDebugInfo('Starting call polling every 2 seconds')
    
    pollingRef.current = setInterval(async () => {
      try {
        // Only poll if we're idle and available
        if (callState !== 'idle' || !isAvailable) {
          return
        }

        addDebugInfo('Checking for waiting calls...')
        
        // Look for waiting calls - with detailed debugging
        const { data: waitingSessions, error } = await supabase
          .from('call_sessions')
          .select('*')
          .eq('status', 'waiting')
          .is('agent_id', null)
          .order('started_at', { ascending: true })

        // Debug: Check ALL sessions first
        const { data: allSessions, error: allError } = await supabase
          .from('call_sessions')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(5)

        if (allError) {
          addDebugInfo(`Error querying all sessions: ${allError.message}`)
        } else {
          addDebugInfo(`Total recent sessions: ${allSessions?.length || 0}`)
          allSessions?.forEach(session => {
            addDebugInfo(`Session ${session.id.slice(-8)}: status=${session.status}, agent_id=${session.agent_id ? 'assigned' : 'null'}`)
          })
        }

        if (error) {
          addDebugInfo(`Error querying calls: ${error.message}`)
          return
        }

        addDebugInfo(`Found ${waitingSessions?.length || 0} waiting calls (status=waiting, agent_id=null)`)

        if (waitingSessions && waitingSessions.length > 0) {
          const session = waitingSessions[0]
          addDebugInfo(`Attempting to claim call: ${session.id}`)
          await claimCall(session)
        }

      } catch (error: any) {
        addDebugInfo(`Polling error: ${error.message}`)
      }
    }, 2000)
  }

  const claimCall = async (session: any) => {
    try {
      addDebugInfo(`Claiming call ${session.id} for agent ${user.id}`)
      
      // Try to claim the call atomically
      const { data: updatedSession, error } = await supabase
        .from('call_sessions')
        .update({ 
          status: 'ringing',
          agent_id: user.id,
          agent_language: language
        })
        .eq('id', session.id)
        .eq('status', 'waiting') // Only update if still waiting
        .is('agent_id', null) // Only update if no agent assigned
        .select()
        .single()

      if (error) {
        addDebugInfo(`Failed to claim call: ${error.message}`)
        return
      }

      if (!updatedSession) {
        addDebugInfo('Call was claimed by another agent')
        return
      }

      addDebugInfo(`Successfully claimed call ${session.id}`)
      
      // Stop polling since we have a call
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }

      // Set up incoming call
      setCurrentSession(updatedSession)
      setCallState('incoming')
      ringToneRef.current?.start()
      
      addDebugInfo('Incoming call setup complete - ringing')
      
      toast({
        title: 'Incoming Call!',
        description: `Caller speaking ${LANGUAGES.find(l => l.code === session.caller_language)?.label}`,
      })

    } catch (error: any) {
      addDebugInfo(`Error claiming call: ${error.message}`)
    }
  }

  const answerCall = async () => {
    try {
      if (!currentSession) {
        addDebugInfo('No current session to answer')
        return
      }

      addDebugInfo(`Answering call ${currentSession.id}`)
      setCallState('connected')
      ringToneRef.current?.stop()

      // Update session to connected
      const { error } = await supabase
        .from('call_sessions')
        .update({ status: 'connected' })
        .eq('id', currentSession.id)

      if (error) {
        addDebugInfo(`Error updating session to connected: ${error.message}`)
        throw error
      }

      addDebugInfo('Session updated to connected - initializing WebRTC')

      // Initialize WebRTC
      await initializeWebRTC()
      
      toast({ 
        title: 'Call connected!', 
        description: 'You can now speak with the caller' 
      })

    } catch (error: any) {
      addDebugInfo(`Failed to answer call: ${error.message}`)
      toast({ 
        title: 'Connection failed', 
        description: error.message,
        variant: 'destructive'
      })
      setCallState('idle')
    }
  }

  const endCall = async () => {
    try {
      addDebugInfo('Ending call')
      
      if (currentSession) {
        await supabase
          .from('call_sessions')
          .update({ 
            status: 'ended',
            ended_at: new Date().toISOString(),
            duration: callDuration
          })
          .eq('id', currentSession.id)
      }

      setCallState('ended')
      ringToneRef.current?.stop()
      
      if (realtimeRef.current) {
        realtimeRef.current.hangup()
        realtimeRef.current = null
      }
      
      setIsListening(false)
      setCurrentSpeech('')
      setCurrentTranslation('')

      setTimeout(() => {
        setCallState('idle')
        setCurrentSession(null)
        addDebugInfo('Call cleanup complete - back to idle')
      }, 2000)

      toast({ title: 'Call ended', description: `Duration: ${formatDuration(callDuration)}` })
    } catch (error: any) {
      addDebugInfo(`Error ending call: ${error.message}`)
    }
  }

  const initializeWebRTC = async () => {
    try {
      const callerLang = LANGUAGES.find(l => l.code === currentSession.caller_language)?.label || 'English'
      
      addDebugInfo(`Initializing WebRTC for translation to ${callerLang}`)
      
      const handle = await startRealtime({
        targetLanguage: callerLang,
        voice: 'coral',
        onPartial: (text) => setCurrentTranslation(text),
        onFinal: (text) => {
          setCurrentTranslation(text)
          playNotificationSound()
        },
        onSourceFinal: (text) => setCurrentSpeech(text),
        onError: (error) => {
          addDebugInfo(`Realtime error: ${error}`)
          toast({ 
            title: 'Translation error', 
            description: 'Connection to translation service failed',
            variant: 'destructive'
          })
        }
      })

      realtimeRef.current = handle
      setIsListening(true)
      addDebugInfo('WebRTC initialized successfully')
    } catch (error: any) {
      addDebugInfo(`WebRTC initialization failed: ${error.message}`)
      toast({ 
        title: 'Connection failed', 
        description: 'Unable to establish voice connection',
        variant: 'destructive'
      })
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
              <h1 className="text-xl font-bold text-slate-900">Agent Dashboard</h1>
              <p className="text-sm text-slate-500">Welcome, {user?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant={isAvailable ? 'default' : 'secondary'} className="px-3 py-1">
              <div className={`w-2 h-2 rounded-full mr-2 ${isAvailable ? 'bg-green-500' : 'bg-slate-400'}`} />
              {isAvailable ? 'Available' : 'Unavailable'}
            </Badge>

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Call Control */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Headphones className="w-5 h-5" />
                Call Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Availability Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium">Available for calls</span>
                <Button
                  variant={isAvailable ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsAvailable(!isAvailable)}
                  disabled={callState !== 'idle'}
                >
                  {isAvailable ? 'Available' : 'Unavailable'}
                </Button>
              </div>

              {/* Main Call Button */}
              <div className="text-center">
                <div 
                  className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
                    callState === 'incoming' ? 'bg-green-500 hover:bg-green-600 cursor-pointer animate-pulse' :
                    callState === 'connected' ? 'bg-red-500 hover:bg-red-600 cursor-pointer' :
                    'bg-slate-400'
                  }`}
                  onClick={() => {
                    if (callState === 'incoming') answerCall()
                    else if (callState === 'connected') endCall()
                  }}
                >
                  {callState === 'idle' && <Headphones className="w-8 h-8 text-white" />}
                  {callState === 'incoming' && <PhoneIncoming className="w-8 h-8 text-white" />}
                  {callState === 'connected' && <PhoneOff className="w-8 h-8 text-white" />}
                  {callState === 'ended' && <PhoneOff className="w-8 h-8 text-white" />}
                </div>
                
                <p className="mt-4 text-sm font-medium text-slate-700">
                  {callState === 'idle' && (isAvailable ? 'Waiting for calls...' : 'Unavailable')}
                  {callState === 'incoming' && 'Answer Call'}
                  {callState === 'connected' && 'End Call'}
                  {callState === 'ended' && 'Call Ended'}
                </p>
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

              {/* Language Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">Your Language</label>
                <Select 
                  value={language} 
                  onValueChange={setLanguage}
                  disabled={callState !== 'idle'}
                >
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

              {/* Caller Info */}
              {currentSession && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Caller Information</h4>
                  <p className="text-sm text-blue-700">
                    Language: {getLangInfo(currentSession.caller_language)?.flag} {getLangInfo(currentSession.caller_language)?.label}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Translation */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Languages className="w-5 h-5" />
                Live Translation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {/* Caller Speech */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    Caller ({currentSession ? getLangInfo(currentSession.caller_language)?.label : 'Unknown'})
                  </span>
                </div>
                <p className="text-slate-900 min-h-[24px]">
                  {currentTranslation || (callState === 'connected' ? 'Listening...' : 'Not connected')}
                </p>
              </div>

              {/* Your Speech */}
              <div className="p-4 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">
                    You ({getLangInfo(language)?.label})
                  </span>
                  {isListening && (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </div>
                <p className="text-slate-900 min-h-[24px]">
                  {currentSpeech || (callState === 'connected' ? 'Speak now...' : 'Not connected')}
                </p>
              </div>

              {/* Call Status */}
              <div className="text-center py-4">
                {callState === 'idle' && isAvailable && (
                  <div className="flex items-center justify-center gap-2 text-slate-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Ready to receive calls</span>
                  </div>
                )}
                {callState === 'idle' && !isAvailable && (
                  <div className="flex items-center justify-center gap-2 text-slate-400">
                    <div className="w-2 h-2 bg-slate-400 rounded-full" />
                    <span>Currently unavailable</span>
                  </div>
                )}
                {callState === 'incoming' && (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <PhoneIncoming className="w-4 h-4 animate-pulse" />
                    <span>Incoming call - Click to answer</span>
                  </div>
                )}
                {callState === 'connected' && (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Connected - Helping customer</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Debug Panel */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔍 Debug Info
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {debugInfo.map((info, index) => (
                  <div key={index} className="text-xs font-mono bg-slate-50 p-2 rounded border">
                    {info}
                  </div>
                ))}
                {debugInfo.length === 0 && (
                  <div className="text-sm text-slate-500 text-center py-4">
                    Debug information will appear here
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}