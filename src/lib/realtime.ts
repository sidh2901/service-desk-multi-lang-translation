export type RealtimeHandle = {
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  hangup: () => void;
  setTargetLanguage: (lang: string) => void;
  setVoice: (voice: string) => void;
};

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
    // Get ephemeral token
    console.log('🔑 Requesting ephemeral token...');
    const tokenResponse = await fetch('/api/token');
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token request failed:', errorText);
      throw new Error(`Token request failed: ${tokenResponse.status} ${errorText}`);
    }
    
    const responseText = await tokenResponse.text();
    console.log('📄 Token response:', responseText.substring(0, 100) + '...');
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse token response as JSON:', parseError);
      console.error('📄 Raw response:', responseText);
      throw new Error('Invalid JSON response from token endpoint');
    }
    
    const EPHEMERAL_KEY = data?.client_secret?.value;

    if (!EPHEMERAL_KEY) {
      console.error('❌ No ephemeral key in response:', data);
      throw new Error("No ephemeral key in response");
    }

    console.log('✅ Got ephemeral token, starting WebRTC...');

    // Get user media
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });

    console.log('🎤 Got user media stream');

    // Create peer connection
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
    });

    // Set up to play remote audio from the model
    const audioElement = document.createElement("audio");
    audioElement.autoplay = true;
    (audioElement as any).playsInline = true;
    pc.ontrack = (e) => (audioElement.srcObject = e.streams[0]);

    // Add local audio track for microphone input
    const [track] = stream.getTracks();
    pc.addTrack(track, stream);

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel("oai-events");
    let dcOpen = false;
    let buf = "";

    const pushSessionUpdate = (update: any) =>
      dcOpen && dc.send(JSON.stringify({ type: "session.update", session: update }));

    const setTargetLanguage = (lang: string) => {
      const instr =
        `You are a professional interpreter. Input is user speech (auto-detected). ` +
        `Output ONLY the translation in ${lang}. Speak it clearly and include matching text. No extra words.`;
      pushSessionUpdate({ instructions: instr });
    };

    const setVoice = (v: string) => pushSessionUpdate({ voice: v });

    dc.onopen = () => {
      console.log('📡 Data channel opened');
      dcOpen = true;
      setVoice(voice);
      setTargetLanguage(targetLanguage);
    };

    dc.addEventListener("message", (e) => {
      let msg: any;
      try { 
        msg = JSON.parse(e.data); 
      } catch { 
        return; 
      }

      console.log('📨 Received message:', msg.type);

      switch (msg.type) {
        case "input_audio_buffer.speech_started":
          buf = "";
          break;
        case "input_audio_buffer.transcription.completed":
          const src = msg.transcript ?? msg.text ?? "";
          if (src) onSourceFinal?.(src);
          break;
        case "response.text.delta":
        case "response.output_text.delta":
        case "response.delta":
          buf += msg.delta ?? "";
          onPartial?.(buf);
          break;
        case "response.output_text.done":
        case "response.completed":
        case "response.done":
          if (buf.trim()) onFinal?.(buf);
          buf = "";
          break;
        case "error":
          console.error('❌ Realtime API error:', msg.error);
          onError?.(new Error(msg.error?.message || "Realtime error"));
          break;
      }
    });

    // Start the session using SDP
    console.log('🤝 Creating WebRTC offer...');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    console.log('📡 Sending SDP to OpenAI...');
    const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      body: pc.localDescription?.sdp ?? offer.sdp!,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    if (!sdpResponse.ok) {
      const errorText = await sdpResponse.text();
      console.error('❌ SDP exchange failed:', errorText);
      throw new Error(`SDP exchange failed: ${sdpResponse.status} ${errorText}`);
    }

    const answer = {
      type: "answer" as RTCSdpType,
      sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);

    console.log('✅ AI Translation system started successfully!');

    const hangup = () => {
      try { dc.close(); } catch {}
      pc.getSenders().forEach((s) => s.track?.stop());
      pc.close();
      stream.getTracks().forEach((t) => t.stop());
    };

    return { pc, dc, hangup, setTargetLanguage, setVoice };
  } catch (e) {
    console.error('❌ startRealtime failed:', e);
    onError?.(e);
    throw e;
  }
}