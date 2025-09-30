export type RealtimeHandle = {
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  hangup: () => void;
  setTargetLanguage: (lang: string) => void;
  setVoice: (voice: string) => void;
};

import { getEphemeralToken } from './tokenService';

export async function startRealtime({
  targetLanguage,
  voice,
  onPartial,
  onFinal,
  onSourceFinal,
  onError,
}: {
  targetLanguage: string;
  voice: string;
  onPartial?: (t: string) => void;
  onFinal?: (t: string) => void;
  onSourceFinal?: (t: string) => void;
  onError?: (e: any) => void;
}): Promise<RealtimeHandle> {
  console.log('🤖 Starting REAL OpenAI Realtime API...')
  
  try {
    // Check if we're in development mode
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    
    if (isDev) {
      console.log('🔧 Development mode: Using mock AI translation')
      return createMockRealtimeHandle({
        targetLanguage,
        voice,
        onPartial,
        onFinal,
        onSourceFinal,
        onError
      })
    }

    // Production: Get ephemeral token from OpenAI
    const tokenData = await getEphemeralToken()
    console.log('✅ Got ephemeral token, starting WebRTC...')

    // Get user media
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { 
        echoCancellation: true, 
        noiseSuppression: true, 
        autoGainControl: true,
        sampleRate: 24000
      },
    })
    console.log('🎤 Got user media stream')

    // Create peer connection
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    // Add audio track
    const audioTrack = stream.getAudioTracks()[0]
    pc.addTrack(audioTrack, stream)
    console.log('🎵 Added audio track to peer connection')

    // Create data channel for sending instructions
    const dc = pc.createDataChannel('oai-events', { ordered: true })
    console.log('📡 Created data channel')

    // Set up data channel handlers
    dc.onopen = () => {
      console.log('📡 Data channel opened')
      
      // Send session configuration
      const sessionConfig = {
        type: 'session.update',
        session: {
          instructions: `You are a professional multilingual customer service agent. 
          
          CRITICAL INSTRUCTIONS:
          1. The caller speaks ${getLanguageFullName(targetLanguage)}
          2. You must respond in ${getLanguageFullName(targetLanguage)}
          3. Provide helpful, professional customer service
          4. Be friendly and patient
          5. Ask clarifying questions if needed
          
          Always respond in ${getLanguageFullName(targetLanguage)} language.`,
          voice: voice,
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          }
        }
      }
      
      dc.send(JSON.stringify(sessionConfig))
      console.log(`🌍 Configured session for ${targetLanguage} language`)
    }

    dc.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        console.log('📨 Received message:', message.type)
        
        switch (message.type) {
          case 'input_audio_buffer.speech_started':
            console.log('🎤 User started speaking')
            break
            
          case 'input_audio_buffer.speech_stopped':
            console.log('🎤 User stopped speaking')
            break
            
          case 'input_audio_buffer.transcription.completed':
            console.log('👤 User said:', message.transcript)
            if (onSourceFinal) onSourceFinal(message.transcript)
            break
            
          case 'response.audio_transcript.delta':
            console.log('🗣️ AI partial:', message.delta)
            if (onPartial) onPartial(message.delta)
            break
            
          case 'response.audio_transcript.done':
            console.log('🗣️ AI final:', message.transcript)
            if (onFinal) onFinal(message.transcript)
            break
            
          case 'error':
            console.error('❌ OpenAI error:', message.error)
            if (onError) onError(new Error(message.error.message))
            break
        }
      } catch (error) {
        console.error('❌ Error parsing message:', error)
      }
    }

    // Create offer
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    console.log('📤 Created and set local offer')

    // Wait for ICE gathering
    await waitForIceGathering(pc)
    console.log('🧊 ICE gathering complete')

    // Connect to OpenAI Realtime API
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.client_secret.value}`,
        'Content-Type': 'application/sdp',
      },
      body: pc.localDescription?.sdp,
    })

    if (!response.ok) {
      throw new Error(`OpenAI connection failed: ${response.status}`)
    }

    const answerSdp = await response.text()
    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
    console.log('✅ Connected to OpenAI Realtime API!')

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('🔌 Connection state:', pc.connectionState)
      if (pc.connectionState === 'failed') {
        console.error('❌ WebRTC connection failed')
        if (onError) onError(new Error('WebRTC connection failed'))
      }
    }

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE connection state:', pc.iceConnectionState)
    }

    const hangup = () => {
      console.log('📞 Hanging up OpenAI Realtime connection')
      
      // Stop all tracks
      stream.getTracks().forEach(track => {
        track.stop()
        console.log('🛑 Stopped track:', track.kind)
      })
      
      // Close data channel
      if (dc.readyState === 'open') {
        dc.close()
      }
      
      // Close peer connection
      pc.close()
      console.log('✅ OpenAI Realtime connection closed')
    }

    const setTargetLanguage = (lang: string) => {
      console.log(`🌍 Updating target language to: ${lang}`)
      if (dc.readyState === 'open') {
        const updateConfig = {
          type: 'session.update',
          session: {
            instructions: `You are a professional multilingual customer service agent. 
            
            CRITICAL INSTRUCTIONS:
            1. The caller speaks ${getLanguageFullName(lang)}
            2. You must respond in ${getLanguageFullName(lang)}
            3. Provide helpful, professional customer service
            4. Be friendly and patient
            5. Ask clarifying questions if needed
            
            Always respond in ${getLanguageFullName(lang)} language.`
          }
        }
        dc.send(JSON.stringify(updateConfig))
      }
    }

    const setVoice = (newVoice: string) => {
      console.log(`🗣️ Updating voice to: ${newVoice}`)
      if (dc.readyState === 'open') {
        const updateConfig = {
          type: 'session.update',
          session: {
            voice: newVoice
          }
        }
        dc.send(JSON.stringify(updateConfig))
      }
    }

    return {
      pc,
      dc,
      hangup,
      setTargetLanguage,
      setVoice
    }

  } catch (error) {
    console.error('❌ startRealtime failed:', error)
    if (onError) onError(error)
    throw error
  }
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve()
  
  return new Promise<void>((resolve) => {
    const handleIceGatheringStateChange = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", handleIceGatheringStateChange)
        resolve()
      }
    }
    pc.addEventListener("icegatheringstatechange", handleIceGatheringStateChange)
  })
}

function getLanguageFullName(code: string): string {
  const langMap: { [key: string]: string } = {
    'marathi': 'Marathi',
    'spanish': 'Spanish', 
    'english': 'English',
    'hindi': 'Hindi',
    'french': 'French',
    'german': 'German'
  }
  return langMap[code] || 'English'
}

// Mock realtime handle for development
function createMockRealtimeHandle({
  targetLanguage,
  voice,
  onPartial,
  onFinal,
  onSourceFinal,
  onError
}: {
  targetLanguage: string;
  voice: string;
  onPartial?: (t: string) => void;
  onFinal?: (t: string) => void;
  onSourceFinal?: (t: string) => void;
  onError?: (e: any) => void;
}): Promise<RealtimeHandle> {
  console.log('🎭 Creating mock AI translation for development')
  
  return new Promise((resolve) => {
    // Simulate connection delay
    setTimeout(() => {
      console.log('✅ Mock AI translation connected!')
      
      // Simulate periodic translations
      let counter = 0
      const interval = setInterval(() => {
        counter++
        const mockTranslations = [
          'Hello, how can I help you today?',
          'I understand your concern.',
          'Let me assist you with that.',
          'Is there anything else I can help with?'
        ]
        
        const translation = mockTranslations[counter % mockTranslations.length]
        
        if (onPartial) onPartial(translation.substring(0, translation.length / 2))
        setTimeout(() => {
          if (onFinal) onFinal(translation)
        }, 500)
        
        if (onSourceFinal) onSourceFinal(`User input ${counter}`)
      }, 5000)
      
      const mockHandle: RealtimeHandle = {
        pc: null,
        dc: null,
        hangup: () => {
          console.log('📞 Mock AI translation disconnected')
          clearInterval(interval)
        },
        setTargetLanguage: (lang: string) => {
          console.log(`🌍 Mock: Updated target language to ${lang}`)
        },
        setVoice: (newVoice: string) => {
          console.log(`🗣️ Mock: Updated voice to ${newVoice}`)
        }
      }
      
      resolve(mockHandle)
    }, 1000)
  })
}