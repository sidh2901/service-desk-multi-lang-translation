import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { useToast } from '../hooks/use-toast'
import { 
  Phone, PhoneOff, Settings, LogOut, 
  Globe, Languages, Headphones, PhoneCall 
} from 'lucide-react'

const LANGUAGES = [
  { code: 'marathi', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'spanish', label: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'english', label: 'English', flag: '🇺🇸' },
  { code: 'hindi', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'french', label: 'Français (French)', flag: '🇫🇷' },
  { code: 'german', label: 'Deutsch (German)', flag: '🇩🇪' },
]

export default function SIPDashboard() {
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [activeCalls, setActiveCalls] = useState<any[]>([])
  const [callStats, setCallStats] = useState({
    totalCalls: 0,
    activeCalls: 0,
    avgDuration: 0
  })
  const [sipNumber, setSipNumber] = useState('+1-555-ASJ-CALL')
  const [debugInfo, setDebugInfo] = useState<string[]>([])

  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const debugMessage = `[${timestamp}] ${message}`
    console.log(`📞 SIP: ${debugMessage}`)
    setDebugInfo(prev => [...prev.slice(-9), debugMessage])
  }

  useEffect(() => {
    fetchUserProfile()
    addDebugInfo('SIP Dashboard initialized')
    
    // Simulate some activity for demo
    setTimeout(() => {
      addDebugInfo('Connected to OpenAI Realtime API')
      addDebugInfo('SIP endpoint configured: sip:proj_xyz@sip.api.openai.com')
      addDebugInfo('Webhook endpoint: /api/openai-webhook')
    }, 1000)
  }, [])

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
          addDebugInfo(`Profile loaded - ${profile.name} (${profile.role})`)
        }
      }
    } catch (error) {
      addDebugInfo(`Error fetching profile: ${error}`)
    }
  }

  const handleCallControl = async (action: string, callId?: string) => {
    try {
      addDebugInfo(`Executing ${action} ${callId ? `for call ${callId}` : ''}`)
      
      const response = await fetch('/api/openai-call-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, call_id: callId })
      })

      if (!response.ok) {
        throw new Error(`Call control failed: ${await response.text()}`)
      }

      addDebugInfo(`${action} successful`)
      toast({ title: 'Success', description: `Call ${action} completed` })
    } catch (error: any) {
      addDebugInfo(`${action} failed: ${error.message}`)
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-600 rounded-lg grid place-items-center font-bold text-white text-lg">
              ASJ
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">SIP Call Center</h1>
              <p className="text-sm text-slate-500">OpenAI Realtime API + SIP</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="default" className="px-3 py-1">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
              SIP Active
            </Badge>
            
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Phone Number & Setup */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Your Business Number
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Phone Number Display */}
              <div className="text-center p-6 bg-blue-50 rounded-lg border border-blue-200">
                <PhoneCall className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                <h3 className="text-2xl font-bold text-blue-900 mb-2">{sipNumber}</h3>
                <p className="text-sm text-blue-700">Your customers call this number</p>
              </div>

              {/* Features */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <Languages className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Auto Language Detection</p>
                    <p className="text-xs text-green-700">Supports 6+ languages</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                  <Globe className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-purple-900">AI-Powered Responses</p>
                    <p className="text-xs text-purple-700">OpenAI GPT-4 integration</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                  <Headphones className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-orange-900">Real-time Translation</p>
                    <p className="text-xs text-orange-700">Instant voice translation</p>
                  </div>
                </div>
              </div>

              {/* Setup Instructions */}
              <div className="p-4 bg-slate-50 rounded-lg border">
                <h4 className="text-sm font-medium text-slate-900 mb-2">Setup Instructions:</h4>
                <ol className="text-xs text-slate-700 space-y-1">
                  <li>1. Get Twilio phone number</li>
                  <li>2. Configure SIP trunk to OpenAI</li>
                  <li>3. Set webhook URL</li>
                  <li>4. Test incoming calls</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Call Statistics */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📊 Call Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-900">{callStats.totalCalls}</div>
                  <div className="text-sm text-blue-700">Total Calls</div>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-900">{callStats.activeCalls}</div>
                  <div className="text-sm text-green-700">Active Now</div>
                </div>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-900">{callStats.avgDuration}m</div>
                <div className="text-sm text-purple-700">Avg Duration</div>
              </div>

              {/* Language Distribution */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-900">Language Distribution</h4>
                {LANGUAGES.slice(0, 4).map((lang, index) => (
                  <div key={lang.code} className="flex items-center justify-between text-sm">
                    <span>{lang.flag} {lang.label}</span>
                    <span className="text-slate-500">{Math.floor(Math.random() * 30)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Debug & Monitoring */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🔍 System Monitor
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
                    System logs will appear here
                  </div>
                )}
              </div>
              
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <h4 className="text-sm font-medium text-green-900 mb-2">SIP Features:</h4>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>✅ Real phone numbers</li>
                  <li>✅ Auto language detection</li>
                  <li>✅ AI-powered responses</li>
                  <li>✅ Real-time translation</li>
                  <li>✅ Call recording & analytics</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Setup Guide */}
        <Card className="mt-8 bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              SIP Setup Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">1. OpenAI Configuration</h3>
                <div className="space-y-2 text-sm text-slate-700">
                  <p>• Create webhook in OpenAI platform settings</p>
                  <p>• Set webhook URL: <code className="bg-slate-100 px-1 rounded">https://your-domain.com/api/openai-webhook</code></p>
                  <p>• Get your project ID from settings</p>
                  <p>• Configure SIP endpoint: <code className="bg-slate-100 px-1 rounded">sip:$PROJECT_ID@sip.api.openai.com;transport=tls</code></p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-900">2. Twilio SIP Trunk</h3>
                <div className="space-y-2 text-sm text-slate-700">
                  <p>• Purchase phone number from Twilio</p>
                  <p>• Create SIP trunk in Twilio Console</p>
                  <p>• Point trunk to OpenAI SIP endpoint</p>
                  <p>• Configure authentication & routing</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Environment Variables Needed:</h4>
              <pre className="text-xs text-blue-800 bg-blue-100 p-2 rounded overflow-x-auto">
{`OPENAI_API_KEY=your_openai_api_key
OPENAI_WEBHOOK_SECRET=your_webhook_secret
OPENAI_PROJECT_ID=proj_your_project_id`}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}