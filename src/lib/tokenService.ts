// Mock token service for development
// In production, this would call your backend API
export async function getEphemeralToken() {
  // For now, we'll create a mock implementation that simulates the AI translation
  // without actually connecting to OpenAI's Realtime API
  
  console.log('🔑 Creating mock ephemeral token for development...')
  
  // Return a mock token structure
  return {
    client_secret: {
      value: 'mock_ephemeral_token_for_development'
    }
  }
}

// Mock WebRTC connection for development
export async function createMockRealtimeConnection({
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
}) {
  console.log(`🤖 Starting mock AI translation (${targetLanguage})...`)
  
  // Simulate getting user media
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    
    console.log('🎤 Got user media stream')
    
    // Create a mock speech recognition for demonstration
    let isListening = true;
    let speechCount = 0;
    
    // Simulate periodic speech detection and translation
    const simulateTranslation = () => {
      if (!isListening) return;
      
      speechCount++;
      const mockTranslations = [
        { source: "Hello, how can I help you?", translation: "Hola, ¿cómo puedo ayudarte?" },
        { source: "I need assistance with my account", translation: "Necesito ayuda con mi cuenta" },
        { source: "Thank you for your help", translation: "Gracias por tu ayuda" },
        { source: "Can you explain this to me?", translation: "¿Puedes explicarme esto?" },
        { source: "I understand now", translation: "Ahora entiendo" }
      ];
      
      const randomTranslation = mockTranslations[speechCount % mockTranslations.length];
      
      // Simulate source speech detection
      setTimeout(() => {
        if (onSourceFinal) onSourceFinal(randomTranslation.source);
      }, 1000);
      
      // Simulate translation with partial updates
      let partialText = '';
      const words = randomTranslation.translation.split(' ');
      
      words.forEach((word, index) => {
        setTimeout(() => {
          partialText += (index > 0 ? ' ' : '') + word;
          if (onPartial) onPartial(partialText);
          
          if (index === words.length - 1) {
            setTimeout(() => {
              if (onFinal) onFinal(partialText);
            }, 200);
          }
        }, index * 300);
      });
      
      // Schedule next simulation
      setTimeout(simulateTranslation, 8000 + Math.random() * 5000);
    };
    
    // Start simulation after a brief delay
    setTimeout(simulateTranslation, 3000);
    
    const hangup = () => {
      console.log('🔌 Ending mock translation session')
      isListening = false;
      stream.getTracks().forEach(track => track.stop());
    };
    
    const setTargetLanguage = (lang: string) => {
      console.log(`🌍 Mock: Setting target language to ${lang}`);
    };
    
    const setVoice = (v: string) => {
      console.log(`🗣️ Mock: Setting voice to ${v}`);
    };
    
    return {
      pc: null, // Mock peer connection
      dc: null, // Mock data channel
      hangup,
      setTargetLanguage,
      setVoice
    };
    
  } catch (error) {
    console.error('❌ Failed to get user media:', error);
    if (onError) onError(error);
    throw error;
  }
}
</parameter>