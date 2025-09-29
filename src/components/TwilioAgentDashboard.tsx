'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { twilioService } from '../lib/twilio'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useToast } from '../hooks/use-toast'
import { 
  PhoneIncoming, PhoneOff, Mic, MicOff, Volume2, 
  LogOut, Headphones, Languages, User 
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

export default function TwilioAgentDashboard() {
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [callState, setCallState] = useState<CallState>('idle')
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [language, setLanguage] = useState('spanish')
  const [isAvailable, setIsAvailable] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [incomingConnection, setIncomingConnection] = useState<any>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const debugMessage = `[${timestamp}] ${message}`
    console.log(`📞 TWILIO AGENT: ${debugMessage}`)
    setDebugInfo(prev => [...prev.slice(-9), debugMessage])
  }

  useEffect(() => {
    initializeTwilio()
    fetchUserProfile()
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
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

  const initializeTwilio = async () => {
    try {
      addDebugInfo('Initializing Twilio for agent...')
      
      // Get Twilio access token for agent
      const response = await fetch('/api/twilio-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          identity: `agent_${Date.now()}`,
          role: 'agent'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get Twilio token')
      }

      const { accessToken } = await response.json()
      
      // Initialize Twilio Device
      const success = await twilioService.initialize(accessToken)
      
      if (success) {
        setIsInitialized(true)
        addDebugInfo('Twilio initialized - Ready to receive calls')
        
        // Set up event handlers
        twilioService.onIncomingCall = (connection) => {
          addDebugInfo(`Incoming call from: ${connection.parameters.From}`)
          setIncomingConnection(connection)
          setCallState('incoming')
          toast({ 
            title: 'Incoming Call!', 
            description: `Call from ${connection.parameters.From}`,
          })
        }
        
        twilioService.onCallConnected = (connection) => {
          addDebugInfo('Call connected with customer')
          setCallState('connected')
          toast({ title: 'Call connected!', description: 'You are now speaking with the customer' })
        }
        
        twilioService.onCallEnded = () => {
          addDebugInfo('Call ended')
          setCallState('ended')
          setIncomingConnection(null)
          setTimeout(() => setCallState('idle'), 2000)
          toast({ title: 'Call ended', description: `Duration: ${formatDuration(callDuration)}` })
        }
      } else {
        throw new Error('Failed to initialize Twilio Device')
      }
      
    } catch (error: any) {
      addDebugInfo(`Twilio initialization failed: ${error.message}`)
      toast({ 
        title: 'Initialization failed', 
        description: 'Unable to initialize calling service',
        variant: 'destructive'
      })
    }
  }

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
          addDebugInfo(`Profile loaded - Name: ${profile.name}`)
        }
      }
    } catch (error) {
      addDebugInfo(`Error fetching profile: ${error}`)
    }
  }

  const answerCall = () => {
    if (incomingConnection) {
      addDebugInfo('Answering incoming call')
      twilioService.answerCall()
    }
  }

  const endCall = () => {
    addDebugInfo('Ending call')
    twilioService.hangupCall()
  }

  const toggleMute = () => {
    if (isMuted) {
      twilioService.unmute()
      addDebugInfo('Unmuted')
    } else {
      twilioService.mute()
      addDebugInfo('Muted')
    }
    setIsMuted(!isMuted)
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
              <h1 className="text-xl font-bold text-slate-900">Twilio Agent Dashboard</h1>
              <p className="text-sm text-slate-500">Welcome, {user?.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant={isAvailable && isInitialized ? 'default' : 'secondary'} className="px-3 py-1">
              <div className={`w-2 h-2 rounded-full mr-2 ${isAvailable && isInitialized ? 'bg-green-500' : 'bg-slate-400'}`} />
              {isAvailable && isInitialized ? 'Available' : 'Unavailable'}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Call Control */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Headphones className="w-5 h-5" />
                Twilio Call Control
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
                  disabled={callState !== 'idle' || !isInitialized}
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
                  {callState === 'idle' && (isAvailable && isInitialized ? 'Waiting for calls...' : 'Unavailable')}
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
                    onClick={toggleMute}
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
              {incomingConnection && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Incoming Call</h4>
                  <p className="text-sm text-blue-700">
                    From: {incomingConnection.parameters.From}
                  </p>
                  <p className="text-sm text-blue-700">
                    Language: {incomingConnection.parameters.language || 'Unknown'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Debug Panel */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📞 Twilio Debug Info
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
              
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <h4 className="text-sm font-medium text-green-900 mb-2">Twilio Features:</h4>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>• Real phone number support</li>
                  <li>• Automatic call routing</li>
                  <li>• Professional call quality</li>
                  <li>• Built-in call recording</li>
                  <li>• Global phone network</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}