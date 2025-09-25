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
  Phone, PhoneOff, Mic, MicOff, Volume2, 
  LogOut, User, Languages, PhoneCall 
} from 'lucide-react'

const LANGUAGES = [
  { code: 'marathi', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'spanish', label: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'english', label: 'English', flag: '🇺🇸' },
  { code: 'hindi', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'french', label: 'Français (French)', flag: '🇫🇷' },
  { code: 'german', label: 'Deutsch (German)', flag: '🇩🇪' },
]

type CallState = 'idle' | 'waiting' | 'ringing' | 'connected' | 'ended'

export default function CallerDashboard() {
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [callState, setCallState] = useState<CallState>('idle')
  const [currentSession, setCurrentSession] = useState<any>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [language, setLanguage] = useState('marathi')
  const [currentSpeech, setCurrentSpeech] = useState('')
  const [currentTranslation, setCurrentTranslation] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const realtimeRef = useRef<RealtimeHandle | null>(null)
  const ringToneRef = useRef<RingToneGenerator | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const debugMessage = `[${timestamp}] ${message}`
    console.log(`🔍 CALLER: ${debugMessage}`)
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startCall = async () => {
    try {
      setCallState('waiting')
      ringToneRef.current?.start()
      
      addDebugInfo(`Starting call - User: ${user?.id}, Language: ${language}`)
      
      toast({ title: 'Requesting call...', description: 'Looking for available agent' })

      // Create call session
      const { data: session, error } = await supabase
        .from('call_sessions')
        .insert({
          caller_id: user.id,
          status: 'waiting',
          caller_language: language,
        })
        .select()
        .single()

      if (error) {
        addDebugInfo(`Error creating session: ${error.message}`)
        throw error
      }
      
      addDebugInfo(`Call session created: ${session.id}`)
      setCurrentSession(session)

      // Start polling for session updates
      startPollingForUpdates(session.id)

      // Auto-timeout after 60 seconds
      setTimeout(() => {
        if (callState === 'waiting' && currentSession?.id === session.id) {
          addDebugInfo('Call timeout - no agents available')
          ringToneRef.current?.stop()
          endCall()
          toast({ 
            title: 'No agents available', 
            description: 'Please try again later',
            variant: 'destructive'
          })
        }
      }, 60000)

    } catch (error: any) {
      addDebugInfo(`Failed to start call: ${error.message}`)
      ringToneRef.current?.stop()
      toast({ 
        title: 'Call failed', 
        description: error.message,
        variant: 'destructive'
      })
      setCallState('idle')
    }
  }

  const startPollingForUpdates = (sessionId: string) => {
    addDebugInfo('Starting to poll for session updates every 1 second')
    
    pollingRef.current = setInterval(async () => {
      try {
        // Debug: Check our specific session
        const { data: sessionData, error } = await supabase
          .from('call_sessions')
          .select('*')
          .eq('id', sessionId)
          .single()

        if (error) {
          addDebugInfo(`Error polling session: ${error.message}`)
          return
        }

        if (sessionData) {
          addDebugInfo(`Session ${sessionId.slice(-8)}: status=${sessionData.status}, agent_id=${sessionData.agent_id ? 'assigned' : 'null'}`)
          setCurrentSession(sessionData)
          
          if (sessionData.status === 'ringing' && callState === 'waiting') {
            addDebugInfo('Agent found - call is ringing')
            ringToneRef.current?.stop()
            setTimeout(() => ringToneRef.current?.start(), 100)
            setCallState('ringing')
            toast({ 
              title: 'Agent found!', 
              description: `Agent speaking ${LANGUAGES.find(l => l.code === sessionData.agent_language)?.label || 'Unknown'} - Connecting...` 
            })
          } else if (sessionData.status === 'connected' && callState === 'ringing') {
            addDebugInfo('Call connected - initializing WebRTC')
            setCallState('connected')
            ringToneRef.current?.stop()
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
            initializeWebRTC(sessionData)
            toast({ title: 'Call connected!', description: 'You can now speak' })
          } else if (sessionData.status === 'ended') {
            addDebugInfo('Call ended by agent')
            endCall()
          }
        }
      } catch (error: any) {
        addDebugInfo(`Polling error: ${error.message}`)
      }
    }, 1000)
  }

  const endCall = async () => {
    try {
      addDebugInfo('Ending call')
      
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }

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

  const initializeWebRTC = async (session: any) => {
    try {
      const agentLang = LANGUAGES.find(l => l.code === session.agent_language)?.label || 'Spanish'
      
      addDebugInfo(`Initializing WebRTC for translation to ${agentLang}`)
      
      const handle = await startRealtime({
        targetLanguage: agentLang,
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Call Control */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Call Control
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Main Call Button */}
              <div className="text-center">
                <div 
                  className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                    callState === 'idle' ? 'bg-green-500 hover:bg-green-600' :
                    callState === 'connected' ? 'bg-red-500 hover:bg-red-600' :
                    callState === 'ringing' ? 'bg-blue-500 animate-pulse' :
                    'bg-slate-400'
                  }`}
                  onClick={() => {
                    if (callState === 'idle') startCall()
                    else if (callState === 'connected') endCall()
                  }}
                >
                  {callState === 'idle' && <Phone className="w-8 h-8 text-white" />}
                  {callState === 'waiting' && <PhoneCall className="w-8 h-8 text-white animate-spin" />}
                  {callState === 'ringing' && <PhoneCall className="w-8 h-8 text-white" />}
                  {callState === 'connected' && <PhoneOff className="w-8 h-8 text-white" />}
                  {callState === 'ended' && <PhoneOff className="w-8 h-8 text-white" />}
                </div>
                
                <p className="mt-4 text-sm font-medium text-slate-700">
                  {callState === 'idle' && 'Start Call'}
                  {callState === 'waiting' && 'Finding Agent...'}
                  {callState === 'ringing' && 'Connecting...'}
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
              
              {/* Your Speech */}
              <div className="p-4 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-slate-600" />
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

              {/* Agent Translation */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Languages className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">
                    Agent Translation
                  </span>
                </div>
                <p className="text-slate-900 min-h-[24px]">
                  {currentTranslation || (callState === 'connected' ? 'Listening...' : 'Not connected')}
                </p>
              </div>

              {/* Call Status */}
              <div className="text-center py-4">
                {callState === 'waiting' && (
                  <div className="flex items-center justify-center gap-2 text-slate-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span>Looking for available agent...</span>
                  </div>
                )}
                {callState === 'ringing' && (
                  <div className="flex items-center justify-center gap-2 text-blue-600">
                    <PhoneCall className="w-4 h-4 animate-pulse" />
                    <span>Agent found! Connecting...</span>
                  </div>
                )}
                {callState === 'connected' && (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Connected - Speak naturally</span>
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