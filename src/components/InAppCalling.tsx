import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useToast } from '../hooks/use-toast'
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, 
  Users, PhoneCall, Languages, User, UserCheck, Clock
} from 'lucide-react'

const LANGUAGES = [
  { code: 'marathi', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'spanish', label: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'english', label: 'English', flag: '🇺🇸' },
  { code: 'hindi', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'french', label: 'Français (French)', flag: '🇫🇷' },
  { code: 'german', label: 'Deutsch (German)', flag: '🇩🇪' },
]

type CallState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended'

export default function InAppCalling() {
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [availableUsers, setAvailableUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [callState, setCallState] = useState<CallState>('idle')
  const [currentCall, setCurrentCall] = useState<any>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [language, setLanguage] = useState('english')
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [sipUri] = useState(`sip:proj_PXdQACn4cQHgYaKFV9O2SuoF@sip.api.openai.com`)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const debugMessage = `[${timestamp}] ${message}`
    console.log(`📞 IN-APP: ${debugMessage}`)
    setDebugInfo(prev => [...prev.slice(-9), debugMessage])
  }

  useEffect(() => {
    fetchUserProfile()
    fetchAvailableUsers()
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (wsRef.current) wsRef.current.close()
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
          addDebugInfo(`Profile loaded - ${profile.name} (${profile.role})`)
        }
      }
    } catch (error) {
      addDebugInfo(`Error fetching profile: ${error}`)
    }
  }

  const fetchAvailableUsers = async () => {
    try {
      const { data: users, error } = await supabase
        .from('user_profiles')
        .select('*')
        .neq('id', user?.id || '')

      if (error) throw error

      setAvailableUsers(users || [])
      addDebugInfo(`Found ${users?.length || 0} available users`)
    } catch (error) {
      addDebugInfo(`Error fetching users: ${error}`)
    }
  }

  const startCall = async () => {
    if (!selectedUser) {
      toast({ 
        title: 'Select user', 
        description: 'Please select a user to call',
        variant: 'destructive'
      })
      return
    }

    try {
      setCallState('calling')
      addDebugInfo(`Starting call to user ${selectedUser}`)

      // Create call session in database
      const { data: session, error } = await supabase
        .from('call_sessions')
        .insert({
          caller_id: user.id,
          agent_id: selectedUser,
          status: 'ringing',
          caller_language: language,
          agent_language: 'english' // Will be updated when agent answers
        })
        .select()
        .single()

      if (error) throw error

      setCurrentCall(session)
      setCallState('ringing')
      addDebugInfo(`Call session created: ${session.id}`)

      // Simulate call connection via SIP
      setTimeout(() => {
        if (callState === 'ringing') {
          connectCall(session.id)
        }
      }, 3000)

      toast({ title: 'Calling...', description: 'Connecting to user' })

    } catch (error: any) {
      addDebugInfo(`Failed to start call: ${error.message}`)
      toast({ 
        title: 'Call failed', 
        description: error.message,
        variant: 'destructive'
      })
      setCallState('idle')
    }
  }

  const connectCall = async (sessionId: string) => {
    try {
      addDebugInfo('Call connected - initializing WebSocket')
      setCallState('connected')

      // Update session status
      await supabase
        .from('call_sessions')
        .update({ status: 'connected' })
        .eq('id', sessionId)

      // Connect to OpenAI Realtime API via WebSocket
      const ws = new WebSocket(`wss://api.openai.com/v1/realtime`, {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      })

      ws.onopen = () => {
        addDebugInfo('WebSocket connected to OpenAI Realtime API')
        
        // Configure session for translation
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions: `You are a real-time translator. The user will speak in ${language} and you should translate to the other person's language. Provide clear, natural translations.`,
            voice: 'coral',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            }
          }
        }))
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        addDebugInfo(`WebSocket event: ${data.type}`)
        
        if (data.type === 'input_audio_buffer.transcription.completed') {
          addDebugInfo(`Transcribed: ${data.transcript}`)
        }
      }

      ws.onerror = (error) => {
        addDebugInfo(`WebSocket error: ${error}`)
      }

      ws.onclose = () => {
        addDebugInfo('WebSocket connection closed')
      }

      wsRef.current = ws
      toast({ title: 'Call connected!', description: 'You can now speak with translation' })

    } catch (error: any) {
      addDebugInfo(`Failed to connect call: ${error.message}`)
      toast({ 
        title: 'Connection failed', 
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const endCall = async () => {
    try {
      addDebugInfo('Ending call')
      
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

      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      setCallState('ended')
      setTimeout(() => {
        setCallState('idle')
        setCurrentCall(null)
        setSelectedUser('')
      }, 2000)

      toast({ title: 'Call ended', description: `Duration: ${formatDuration(callDuration)}` })
    } catch (error: any) {
      addDebugInfo(`Error ending call: ${error.message}`)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const getLangInfo = (code: string) => LANGUAGES.find(l => l.code === code)

  return (
    <div className="space-y-6">
      {/* Call Control */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5" />
            In-App Calling with AI Translation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* User Selection */}
          {callState === 'idle' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Call User</label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user to call" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{user.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {user.role}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {getLangInfo(user.language)?.flag} {getLangInfo(user.language)?.label}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

          {/* Call Button */}
          <div className="text-center">
            <div 
              className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
                callState === 'idle' ? 'bg-green-500 hover:bg-green-600' :
                callState === 'calling' ? 'bg-blue-500 animate-pulse' :
                callState === 'ringing' ? 'bg-orange-500 animate-pulse' :
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
              {callState === 'ringing' && <PhoneCall className="w-8 h-8 text-white" />}
              {callState === 'connected' && <PhoneOff className="w-8 h-8 text-white" />}
              {callState === 'ended' && <PhoneOff className="w-8 h-8 text-white" />}
            </div>
            
            <p className="mt-3 text-sm font-medium text-slate-700">
              {callState === 'idle' && 'Start Call'}
              {callState === 'calling' && 'Calling...'}
              {callState === 'ringing' && 'Ringing...'}
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
                <p>Translation: {getLangInfo(language)?.label} ↔ AI Translation</p>
              </div>
            </div>
          )}

          {/* SIP Info */}
          <div className="p-3 bg-slate-50 rounded-lg border">
            <h4 className="text-sm font-medium text-slate-900 mb-2">🔗 SIP Connection</h4>
            <code className="text-xs text-slate-700 bg-white p-2 rounded block break-all">
              {sipUri}
            </code>
            <p className="text-xs text-slate-600 mt-1">
              Calls are routed through OpenAI Realtime API with AI translation
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Debug Panel */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔍 Call Debug Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {debugInfo.map((info, index) => (
              <div key={index} className="text-xs font-mono bg-slate-50 p-2 rounded border">
                {info}
              </div>
            ))}
            {debugInfo.length === 0 && (
              <div className="text-sm text-slate-500 text-center py-4">
                Call debug information will appear here
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}