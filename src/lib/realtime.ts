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
  sourceLanguage,
  voice,
  onPartial,
  onFinal,
  onIncomingTranslation,
  onError,
}: {
  targetLanguage: string;
  sourceLanguage: string;
  voice: string;
  onPartial?: (t: string) => void;
  onFinal?: (t: string) => void;
  onIncomingTranslation?: (t: string) => void;
  onError?: (e: any) => void;
}): Promise<RealtimeHandle> {
  console.log('🤖 Starting REAL OpenAI Realtime API...')
  
  try {
    // Get ephemeral token from OpenAI
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

    // Handle incoming audio from OpenAI
    pc.ontrack = (event) => {
      console.log('🎵 Received audio track from OpenAI')
      
      // Create audio element and play immediately
      const audioElement = document.createElement('audio')
      audioElement.srcObject = event.streams[0]
      audioElement.autoplay = true
      audioElement.volume = 1.0
      audioElement.muted = false
      
      // Add to DOM temporarily to ensure playback
      document.body.appendChild(audioElement)
      
      audioElement.play().then(() => {
        console.log('🔊 Playing translated audio successfully')
      }).catch(error => {
        console.error('❌ Audio playback failed:', error)
      })
      
      // Clean up after audio ends
      audioElement.onended = () => {
        document.body.removeChild(audioElement)
      }
    }

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
        }
      }
    }
  }
}
RULES:
- Input: ${getLanguageFullName(sourceLanguage)} speech
- Output: ONLY the ${getLanguageFullName(targetLanguage)} translation
- Do NOT add extra words
- Do NOT respond to questions
- Do NOT give advice
- JUST translate the words you hear
- If someone asks "How are you?" in ${getLanguageFullName(sourceLanguage)}, you say "How are you?" in ${getLanguageFullName(targetLanguage)}
Example: If you hear "Hello" in ${getLanguageFullName(sourceLanguage)}, say "Hello" in ${getLanguageFullName(targetLanguage)}.`,
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          input_audio_transcription: {
            model: 'whisper-1'
          },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 800
          },
          temperature: 0.0,
          max_response_output_tokens: 50
        }
      }
      
      dc.send(JSON.stringify(sessionConfig))
      console.log(`🌍 Configured session for ${targetLanguage} translation`)
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
            if (onIncomingTranslation) onIncomingTranslation(message.transcript)
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
    const response = await fetch('https://api.openai.com/v1/realtime', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.client_secret?.value || tokenData.token}`,
        'Content-Type': 'application/sdp',
      },
      body: pc.localDescription?.sdp,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ OpenAI Realtime API error:', response.status, errorText)
      throw new Error(`OpenAI Realtime API connection failed: ${response.status} - ${errorText}`)
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
            instructions: `You are a TRANSLATION MACHINE. You translate from ${getLanguageFullName(sourceLanguage)} to ${getLanguageFullName(lang)}.

RULES:
- Input: ${getLanguageFullName(sourceLanguage)} speech
- Output: ONLY the ${getLanguageFullName(lang)} translation
- Do NOT add extra words
- Do NOT respond to questions
- Do NOT give advice
- JUST translate the words you hear

Example: If you hear "Hello" in ${getLanguageFullName(sourceLanguage)}, say "Hello" in ${getLanguageFullName(lang)}.`,
            temperature: 0.0,
            max_response_output_tokens: 50
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