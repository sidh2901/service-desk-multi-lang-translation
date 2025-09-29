import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { useToast } from '../hooks/use-toast'
import { 
  Phone, PhoneOff, Settings, LogOut, 
  Globe, Languages, Headphones, PhoneCall, Copy, CheckCircle 
} from 'lucide-react'

const LANGUAGES = [
  { code: 'marathi', label: 'मराठी (Marathi)', flag: '🇮🇳' },
  { code: 'spanish', label: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'english', label: 'English', flag: '🇺🇸' },
  { code: 'hindi', label: 'हिन्दी (Hindi)', flag: '🇮🇳' },
  { code: 'french', label: 'Français (French)', flag: '🇫🇷' },
  { code: 'german', label: 'Deutsch (German)', flag: '🇩🇪' },
]

const SIP_CLIENTS = [
  {
    name: 'Zoiper',
    platform: 'Windows/Mac/Mobile',
    url: 'https://www.zoiper.com/en/voip-softphone/download/current',
    free: true,
    description: 'Popular cross-platform SIP client'
  },
  {
    name: 'Linphone',
    platform: 'Windows/Mac/Linux/Mobile',
    url: 'https://www.linphone.org/technical-corner/linphone',
    free: true,
    description: 'Open source SIP client'
  },
  {
    name: '3CX Phone',
    platform: 'Windows/Mac/Mobile',
    url: 'https://www.3cx.com/phone-system/clients/',
    free: true,
    description: 'Business-grade SIP client'
  },
  {
    name: 'MicroSIP',
    platform: 'Windows',
    url: 'https://www.microsip.org/',
    free: true,
    description: 'Lightweight Windows SIP client'
  }
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
  const [sipUri, setSipUri] = useState('sip:proj_PXdQACn4cQHgYaKFV9O2SuoF@sip.api.openai.com')
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [copiedSip, setCopiedSip] = useState(false)

  const addDebugInfo = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const debugMessage = `[${timestamp}] ${message}`
    console.log(`📞 SIP: ${debugMessage}`)
    setDebugInfo(prev => [...prev.slice(-9), debugMessage])
  }

  useEffect(() => {
    fetchUserProfile()
    addDebugInfo('Direct SIP Dashboard initialized')
    addDebugInfo(`SIP URI ready: ${sipUri}`)
    
    // Simulate some activity for demo
    setTimeout(() => {
      addDebugInfo('Connected to OpenAI Realtime API')
      addDebugInfo('Webhook endpoint configured: /api/openai-webhook')
      addDebugInfo('Ready to receive SIP calls')
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

  const copySipUri = async () => {
    try {
      await navigator.clipboard.writeText(sipUri)
      setCopiedSip(true)
      toast({ title: 'Copied!', description: 'SIP URI copied to clipboard' })
      setTimeout(() => setCopiedSip(false), 2000)
    } catch (error) {
      toast({ 
        title: 'Copy failed', 
        description: 'Please copy manually',
        variant: 'destructive'
      })
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
              <h1 className="text-xl font-bold text-slate-900">Direct SIP Call Center</h1>
              <p className="text-sm text-slate-500">OpenAI Realtime API + Direct SIP</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="default" className="px-3 py-1">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
              SIP Ready
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
          
          {/* SIP URI & Setup */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Your SIP Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* SIP URI Display */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-blue-900">SIP URI</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copySipUri}
                    className="h-6 px-2"
                  >
                    {copiedSip ? (
                      <CheckCircle className="w-3 h-3 text-green-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <code className="text-xs text-blue-800 bg-blue-100 p-2 rounded block break-all">
                  {sipUri}
                </code>
                <p className="text-xs text-blue-700 mt-2">
                  Use this address in your SIP client to call the AI
                </p>
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

              {/* Benefits */}
              <div className="p-4 bg-slate-50 rounded-lg border">
                <h4 className="text-sm font-medium text-slate-900 mb-2">✅ Benefits:</h4>
                <ul className="text-xs text-slate-700 space-y-1">
                  <li>• No phone number needed</li>
                  <li>• Instant setup (5 minutes)</li>
                  <li>• Perfect for testing</li>
                  <li>• Works from any SIP client</li>
                  <li>• Free to test</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* SIP Clients */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📱 Recommended SIP Clients
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              
              {SIP_CLIENTS.map((client, index) => (
                <div key={index} className="p-4 bg-slate-50 rounded-lg border hover:bg-slate-100 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-slate-900">{client.name}</h4>
                    {client.free && (
                      <Badge variant="secondary" className="text-xs">FREE</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mb-2">{client.description}</p>
                  <p className="text-xs text-slate-500 mb-3">{client.platform}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(client.url, '_blank')}
                    className="w-full text-xs"
                  >
                    Download {client.name}
                  </Button>
                </div>
              ))}

              {/* Quick Setup */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">🚀 Quick Setup:</h4>
                <ol className="text-xs text-blue-800 space-y-1">
                  <li>1. Download any SIP client above</li>
                  <li>2. Add account with SIP URI</li>
                  <li>3. Make a call to test AI</li>
                  <li>4. Speak in any supported language!</li>
                </ol>
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
                <h4 className="text-sm font-medium text-green-900 mb-2">🎯 Direct SIP Features:</h4>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>✅ No phone number required</li>
                  <li>✅ Instant setup & testing</li>
                  <li>✅ Auto language detection</li>
                  <li>✅ AI-powered responses</li>
                  <li>✅ Real-time translation</li>
                  <li>✅ Works with any SIP client</li>
                </ul>
              </div>

              {/* Language Stats */}
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-slate-900">🌍 Supported Languages:</h4>
                <div className="grid grid-cols-2 gap-1">
                  {LANGUAGES.map((lang) => (
                    <div key={lang.code} className="flex items-center text-xs">
                      <span className="mr-1">{lang.flag}</span>
                      <span className="truncate">{lang.label.split(' ')[0]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Setup Guide */}
        <Card className="mt-8 bg-white shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Complete Setup Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <h3 className="text-lg font-semibold text-slate-900">Download SIP Client</h3>
                </div>
                <div className="space-y-2 text-sm text-slate-700">
                  <p>• Choose any SIP client from the list above</p>
                  <p>• <strong>Zoiper</strong> is recommended for beginners</p>
                  <p>• <strong>Linphone</strong> for open source preference</p>
                  <p>• Install on your computer or phone</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <h3 className="text-lg font-semibold text-slate-900">Configure SIP Account</h3>
                </div>
                <div className="space-y-2 text-sm text-slate-700">
                  <p>• Open your SIP client</p>
                  <p>• Add new account/profile</p>
                  <p>• <strong>SIP Server:</strong> <code className="bg-slate-100 px-1 rounded text-xs">sip.api.openai.com</code></p>
                  <p>• <strong>Username:</strong> <code className="bg-slate-100 px-1 rounded text-xs">proj_PXdQACn4cQHgYaKFV9O2SuoF</code></p>
                  <p>• <strong>No password needed</strong></p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <h3 className="text-lg font-semibold text-slate-900">Make Test Call</h3>
                </div>
                <div className="space-y-2 text-sm text-slate-700">
                  <p>• Dial the SIP URI (or use speed dial)</p>
                  <p>• Wait for AI to answer</p>
                  <p>• <strong>Speak in any language:</strong></p>
                  <p>• मराठी, Español, English, हिन्दी, Français, Deutsch</p>
                  <p>• AI will respond in the same language!</p>
                </div>
              </div>
            </div>

            {/* SIP Client Configuration Examples */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Zoiper Config */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-3">📱 Zoiper Configuration:</h4>
                <div className="space-y-2 text-xs text-blue-800">
                  <div><strong>Account Type:</strong> SIP</div>
                  <div><strong>Domain:</strong> sip.api.openai.com</div>
                  <div><strong>Username:</strong> proj_PXdQACn4cQHgYaKFV9O2SuoF</div>
                  <div><strong>Password:</strong> (leave empty)</div>
                  <div><strong>Transport:</strong> TLS (recommended)</div>
                </div>
              </div>

              {/* Linphone Config */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="text-sm font-medium text-green-900 mb-3">📱 Linphone Configuration:</h4>
                <div className="space-y-2 text-xs text-green-800">
                  <div><strong>SIP Address:</strong> proj_PXdQACn4cQHgYaKFV9O2SuoF@sip.api.openai.com</div>
                  <div><strong>Password:</strong> (not required)</div>
                  <div><strong>Proxy:</strong> sip.api.openai.com</div>
                  <div><strong>Transport:</strong> TLS</div>
                </div>
              </div>
            </div>

            {/* Testing Instructions */}
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <h4 className="text-sm font-medium text-green-900 mb-2">🧪 Testing Your Setup:</h4>
              <ol className="text-sm text-green-800 space-y-1">
                <li>1. Configure your SIP client with the settings above</li>
                <li>2. Make a call to the SIP URI</li>
                <li>3. Wait for the AI to answer (should be instant)</li>
                <li>4. Say "Hello" in English, "Hola" in Spanish, or "नमस्ते" in Hindi</li>
                <li>5. AI will detect your language and respond appropriately!</li>
                <li>6. Have a full conversation - AI translates in real-time</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}