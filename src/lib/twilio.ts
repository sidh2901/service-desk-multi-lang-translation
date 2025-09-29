// Twilio Voice SDK for browser calling
export class TwilioVoiceService {
  private device: any = null
  private connection: any = null
  private isInitialized = false

  async initialize(accessToken: string) {
    try {
      // Import Twilio Voice SDK dynamically
      const { Device } = await import('twilio-client')
      
      this.device = new Device(accessToken, {
        logLevel: 1,
        answerOnBridge: true,
        enableRingingState: true,
      })

      // Set up event listeners
      this.device.on('ready', () => {
        console.log('Twilio Device Ready')
        this.isInitialized = true
      })

      this.device.on('error', (error: any) => {
        console.error('Twilio Device Error:', error)
      })

      this.device.on('incoming', (connection: any) => {
        console.log('Incoming call from:', connection.parameters.From)
        this.connection = connection
        this.onIncomingCall?.(connection)
      })

      this.device.on('disconnect', () => {
        console.log('Call disconnected')
        this.connection = null
        this.onCallEnded?.()
      })

      return true
    } catch (error) {
      console.error('Failed to initialize Twilio:', error)
      return false
    }
  }

  async makeCall(phoneNumber: string, params: any = {}) {
    if (!this.isInitialized) {
      throw new Error('Twilio not initialized')
    }

    try {
      this.connection = await this.device.connect({
        To: phoneNumber,
        ...params
      })
      
      this.onCallStarted?.(this.connection)
      return this.connection
    } catch (error) {
      console.error('Failed to make call:', error)
      throw error
    }
  }

  answerCall() {
    if (this.connection) {
      this.connection.accept()
      this.onCallConnected?.(this.connection)
    }
  }

  hangupCall() {
    if (this.connection) {
      this.connection.disconnect()
    }
  }

  mute() {
    if (this.connection) {
      this.connection.mute(true)
    }
  }

  unmute() {
    if (this.connection) {
      this.connection.mute(false)
    }
  }

  // Event handlers
  onIncomingCall?: (connection: any) => void
  onCallStarted?: (connection: any) => void
  onCallConnected?: (connection: any) => void
  onCallEnded?: () => void
}

export const twilioService = new TwilioVoiceService()