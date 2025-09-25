export class RingToneGenerator {
  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;
  private intervalId: NodeJS.Timeout | null = null;

  async start() {
    if (this.isPlaying) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.oscillator = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();

      this.oscillator.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      // Create a more realistic ring tone pattern
      this.oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
      this.gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);

      this.oscillator.start();
      this.isPlaying = true;

      // Create ring pattern: ring for 1s, pause for 4s, repeat
      this.createRingPattern();

    } catch (error) {
      console.error('Failed to start ring tone:', error);
    }
  }

  private createRingPattern() {
    if (!this.audioContext || !this.gainNode || !this.isPlaying) return;

    const now = this.audioContext.currentTime;
    
    // Ring pattern: 2 short rings with pause
    this.gainNode.gain.setValueAtTime(0.15, now);
    this.gainNode.gain.setValueAtTime(0.15, now + 0.4);
    this.gainNode.gain.setValueAtTime(0, now + 0.4);
    this.gainNode.gain.setValueAtTime(0, now + 0.6);
    this.gainNode.gain.setValueAtTime(0.15, now + 0.6);
    this.gainNode.gain.setValueAtTime(0.15, now + 1.0);
    this.gainNode.gain.setValueAtTime(0, now + 1.0);

    // Repeat every 4 seconds
    this.intervalId = setTimeout(() => {
      if (this.isPlaying) {
        this.createRingPattern();
      }
    }, 4000);
  }

  stop() {
    if (!this.isPlaying) return;

    try {
      if (this.intervalId) {
        clearTimeout(this.intervalId);
        this.intervalId = null;
      }
      
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
      }
      if (this.audioContext) {
        this.audioContext.close();
      }
    } catch (error) {
      console.error('Error stopping ring tone:', error);
    }

    this.oscillator = null;
    this.gainNode = null;
    this.audioContext = null;
    this.isPlaying = false;
  }
}

export class DialToneGenerator {
  private audioContext: AudioContext | null = null;
  private oscillator1: OscillatorNode | null = null;
  private oscillator2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying = false;

  async start() {
    if (this.isPlaying) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.oscillator1 = this.audioContext.createOscillator();
      this.oscillator2 = this.audioContext.createOscillator();
      this.gainNode = this.audioContext.createGain();

      // Dual tone for dial tone (350Hz + 440Hz)
      this.oscillator1.frequency.setValueAtTime(350, this.audioContext.currentTime);
      this.oscillator2.frequency.setValueAtTime(440, this.audioContext.currentTime);
      
      this.oscillator1.connect(this.gainNode);
      this.oscillator2.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      this.gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);

      this.oscillator1.start();
      this.oscillator2.start();
      this.isPlaying = true;

    } catch (error) {
      console.error('Failed to start dial tone:', error);
    }
  }

  stop() {
    if (!this.isPlaying) return;

    try {
      if (this.oscillator1) {
        this.oscillator1.stop();
        this.oscillator1.disconnect();
      }
      if (this.oscillator2) {
        this.oscillator2.stop();
        this.oscillator2.disconnect();
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
      }
      if (this.audioContext) {
        this.audioContext.close();
      }
    } catch (error) {
      console.error('Error stopping dial tone:', error);
    }

    this.oscillator1 = null;
    this.oscillator2 = null;
    this.gainNode = null;
    this.audioContext = null;
    this.isPlaying = false;
  }
}

export const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
};