import { getEphemeralToken, createMockRealtimeConnection } from './tokenService';

export type RealtimeHandle = {
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  hangup: () => void;
  setTargetLanguage: (lang: string) => void;
  setVoice: (voice: string) => void;
};

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
  try {
    console.log('🤖 Starting AI Translation System...');
    
    // For development, use mock implementation
    // In production, you would implement the full OpenAI Realtime API integration
    const isDevelopment = import.meta.env.DEV || !import.meta.env.VITE_OPENAI_API_KEY;
    
    if (isDevelopment) {
      console.log('🔧 Using mock translation for development');
      return await createMockRealtimeConnection({
        targetLanguage,
        voice,
        onPartial,
        onFinal,
        onSourceFinal,
        onError,
      });
    }
    
    // Production implementation would go here
    // For now, fall back to mock even in production
    console.log('⚠️ Production OpenAI integration not yet implemented, using mock');
    return await createMockRealtimeConnection({
      targetLanguage,
      voice,
      onPartial,
      onFinal,
      onSourceFinal,
      onError,
    });
    
  } catch (e) {
    console.error('❌ startRealtime failed:', e);
    if (onError) onError(e);
    throw e;
  }
}

// Legacy function for compatibility
function waitForIceGathering(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const cb = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", cb);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", cb);
  });
}