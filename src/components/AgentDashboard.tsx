import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { useToast } from '../hooks/use-toast'
import { 
  PhoneIncoming, PhoneOff, Mic, MicOff, Volume2, 
  LogOut, Headphones, Languages, User, Clock
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
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [language, setLanguage] = useState('spanish')
  const [isAvailable, setIsAvailable] = useState(true)
  const [currentCall, setCurrentCall] = useState<any>(null)
  const [incomingCalls, setIncomingCalls] = useState<any[]>([])

  useEffect(() => {
    fetchUserProfile()
    
    // Simulate call timer
    let interval: NodeJS.Timeout
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
    }
    
    return () => {
      clearInterval(interval)
    }
  }, [callState])

  useEffect(() => {
    if (user) {
      subscribeToIncomingCalls()
      // Update availability status when component mounts
      updateAvailabilityStatus()
      
      // Set up periodic availability updates
      const availabilityInterval = setInterval(updateAvailabilityStatus, 30000)
      
      return () => {
        clearInterval(availabilityInterval)
      }
    }
  }, [user])

  useEffect(() => {
    // Update availability when status changes
    if (user) {
      updateAvailabilityStatus()
    }
  }, [isAvailable, user])
  
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
          setIsAvailable(profile.is_available || false)
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const updateAvailabilityStatus = async () => {
    if (!user) return
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          is_available: isAvailable,
          last_seen: new Date().toISOString()
        })
        .eq('id', user.id)
        
      if (error) {
        console.error('Error updating availability:', error)
        // If columns don't exist, try to add them
        if (error.message.includes('column') && error.message.includes('does not exist')) {
          console.log('Availability columns missing, they may need to be added manually')
        }
      } else {
        console.log(`Agent ${user.name} availability updated: ${isAvailable}`)
      }
    } catch (error) {
      console.error('Error updating availability:', error)
    }
  }
  
  const subscribeToIncomingCalls = () => {
    if (!user) return

    // Subscribe to call sessions where this agent is assigned
    const callSubscription = supabase
      .channel('incoming_calls')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          table: 'call_sessions',
          filter: `status=eq.waiting`
        }, 
        (payload) => {
          const newCall = payload.new
          console.log('New call session created:', newCall)
          
          // Only show to available agents
          if (isAvailable && !newCall.agent_id) {
            setIncomingCalls(prev => [...prev, newCall])
            setCallState('incoming')
            toast({ 
              title: 'Incoming Call!', 
              description: 'A caller is waiting for assistance',
            })
          }
        }
      )
      .on('postgres_changes',
        {
          event: 'UPDATE',
          table: 'call_sessions',
          filter: `agent_id=eq.${user.id}`
        },
        (payload) => {
          const updatedCall = payload.new
          console.log('Call session updated:', updatedCall)
          
          if (updatedCall.status === 'ringing') {
            setCurrentCall(updatedCall)
            setCallState('incoming')
          } else if (updatedCall.status === 'connected') {
            setCallState('connected')
          } else if (updatedCall.status === 'ended') {
            setCallState('ended')
            setTimeout(() => {
              setCallState('idle')
              setCurrentCall(null)
              setCallDuration(0)
            }, 2000)
          }
        }
      )
      .subscribe()

    return () => {
      callSubscription.unsubscribe()
    }
  }

  const answerCall = async (callSession: any) => {
    try {
      // First, claim the call by assigning this agent
      const { error: claimError } = await supabase
        .from('call_sessions')
        .update({ 
          agent_id: user.id,
          status: 'ringing',
          agent_language: language
        })
        .eq('id', callSession.id)
        .is('agent_id', null) // Only if not already claimed

      if (claimError) {
        console.error('Error claiming call:', claimError)
        toast({ 
          title: 'Call unavailable', 
          description: 'This call may have been answered by another agent',
          variant: 'destructive'
        })
        return
      }

      setCurrentCall(callSession)
      setCallState('incoming')
      
      // After a brief moment, connect the call
      setTimeout(async () => {
        const { error: connectError } = await supabase
          .from('call_sessions')
          .update({ status: 'connected' })
          .eq('id', callSession.id)

        if (!connectError) {
          setCallState('connected')
          toast({ title: 'Call connected!', description: 'You are now speaking with the caller' })
        }
      }, 1500)

      // Remove from incoming calls
      setIncomingCalls(prev => prev.filter(call => call.id !== callSession.id))
      
    } catch (error: any) {
      console.error('Error answering call:', error)
      toast({ 
        title: 'Error', 
        description: 'Failed to answer call',
        variant: 'destructive'
      })
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Call Control */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Headphones className="w-5 h-5" />
                Agent Call Control
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

              {/* Incoming Calls */}
              {incomingCalls.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-slate-900">Incoming Calls</h4>
                  {incomingCalls.map((call) => (
                    <div key={call.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-900">Incoming Call</p>
                          <p className="text-xs text-blue-700">Language: {getLangInfo(call.caller_language)?.label}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => answerCall(call)}
                          className="bg-green-500 hover:bg-green-600"
                        >
                          <PhoneIncoming className="w-4 h-4 mr-2" />
                          Answer
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Main Call Button */}
              <div className="text-center">
                <div 
                  className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
                    callState === 'idle' ? 'bg-slate-400' :
                    callState === 'incoming' ? 'bg-green-500 animate-pulse' :
                    callState === 'connected' ? 'bg-red-500 hover:bg-red-600 cursor-pointer' :
                    'bg-slate-400'
                  }`}
                  onClick={() => {
                    if (callState === 'connected') endCall()
                  }}
                >
                  {callState === 'idle' && <Headphones className="w-8 h-8 text-white" />}
                  {callState === 'incoming' && <PhoneIncoming className="w-8 h-8 text-white" />}
                  {callState === 'connected' && <PhoneOff className="w-8 h-8 text-white" />}
                  {callState === 'ended' && <PhoneOff className="w-8 h-8 text-white" />}
                </div>
                
                <p className="mt-4 text-sm font-medium text-slate-700">
                  {callState === 'idle' && (isAvailable ? 'Waiting for calls...' : 'Unavailable')}
                  {callState === 'incoming' && 'Incoming Call!'}
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

              {/* Call Info */}
              {currentCall && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Call Information</h4>
                  <div className="space-y-1 text-xs text-blue-700">
                    <p>Session ID: {currentCall.id.slice(-8)}</p>
                    <p>Status: {currentCall.status}</p>
                    <p>Caller Language: {getLangInfo(currentCall.caller_language)?.label}</p>
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
                Agent Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <PhoneIncoming className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Incoming Call Alerts</p>
                    <p className="text-xs text-green-700">Get notified when callers need help</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <Languages className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-purple-900">AI Translation</p>
                    <p className="text-xs text-purple-700">Automatic language translation</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Availability Control</p>
                    <p className="text-xs text-blue-700">Set your availability status</p>
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
                  <li>1. Set yourself as available</li>
                  <li>2. Wait for incoming calls</li>
                  <li>3. Answer calls from callers</li>
                  <li>4. AI translates between languages!</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}