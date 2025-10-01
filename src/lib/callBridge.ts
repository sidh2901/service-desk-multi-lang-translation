// Call Bridge - Manages bidirectional audio between caller and agent
export class CallBridge {
  private callerConnection: RTCPeerConnection | null = null;
  private agentConnection: RTCPeerConnection | null = null;
  private isActive = false;

  constructor() {
    console.log('🌉 CallBridge initialized');
  }

  async setupBidirectionalAudio(callSession: any) {
    try {
      console.log('🌉 Setting up bidirectional audio bridge');
      this.isActive = true;

      // Create peer connections for both sides
      this.callerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      this.agentConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      // Set up audio forwarding between connections
      this.setupAudioForwarding();

      console.log('✅ Bidirectional audio bridge ready');
      return true;
    } catch (error) {
      console.error('❌ Failed to setup audio bridge:', error);
      return false;
    }
  }

  private setupAudioForwarding() {
    // Forward audio from caller to agent
    this.callerConnection?.ontrack = (event) => {
      console.log('🎵 Forwarding caller audio to agent');
      const [stream] = event.streams;
      stream.getTracks().forEach(track => {
        this.agentConnection?.addTrack(track, stream);
      });
    };

    // Forward audio from agent to caller
    this.agentConnection?.ontrack = (event) => {
      console.log('🎵 Forwarding agent audio to caller');
      const [stream] = event.streams;
      stream.getTracks().forEach(track => {
        this.callerConnection?.addTrack(track, stream);
      });
    };
  }

  cleanup() {
    console.log('🌉 Cleaning up call bridge');
    this.isActive = false;
    
    if (this.callerConnection) {
      this.callerConnection.close();
      this.callerConnection = null;
    }
    
    if (this.agentConnection) {
      this.agentConnection.close();
      this.agentConnection = null;
    }
  }
}

export const callBridge = new CallBridge();