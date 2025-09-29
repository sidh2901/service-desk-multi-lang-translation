import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  webhookSecret: process.env.OPENAI_WEBHOOK_SECRET
});

const AUTH_HEADER = {
  "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
  "Content-Type": "application/json"
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Received webhook:', req.body);
    
    // Verify webhook signature
    const event = openai.webhooks.unwrap(req.body, req.headers);
    
    if (event.type === 'realtime.call.incoming') {
      const { call_id, sip_headers } = event.data;
      
      // Extract caller information
      const fromHeader = sip_headers.find(h => h.name === 'From');
      const toHeader = sip_headers.find(h => h.name === 'To');
      const callerNumber = fromHeader?.value || 'Unknown';
      
      console.log(`Incoming call from ${callerNumber} to ${toHeader?.value}`);
      
      // Accept the call with multilingual support
      const acceptResponse = await fetch(`https://api.openai.com/v1/realtime/calls/${call_id}/accept`, {
        method: 'POST',
        headers: AUTH_HEADER,
        body: JSON.stringify({
          type: "realtime",
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "coral",
          instructions: `You are a professional multilingual customer service agent for ASJ Call Center. 
          
          IMPORTANT INSTRUCTIONS:
          1. Detect the caller's language automatically from their speech
          2. Respond in the SAME language the caller is speaking
          3. If they speak Marathi, respond in Marathi
          4. If they speak Spanish, respond in Spanish  
          5. If they speak English, respond in English
          6. If they speak Hindi, respond in Hindi
          7. If they speak French, respond in French
          8. If they speak German, respond in German
          
          Always be helpful, professional, and friendly. Ask how you can assist them today.
          
          Start by greeting them and asking how you can help in their detected language.`,
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500
          },
          input_audio_format: "pcm16",
          output_audio_format: "pcm16",
          input_audio_transcription: {
            model: "whisper-1"
          }
        })
      });

      if (!acceptResponse.ok) {
        throw new Error(`Failed to accept call: ${await acceptResponse.text()}`);
      }

      console.log(`Call ${call_id} accepted successfully`);

      // Start WebSocket connection to monitor the call
      startWebSocketMonitoring(call_id);
      
      return res.status(200).json({ success: true, call_id });
    }

    return res.status(200).json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: 'Webhook processing failed',
      details: error.message 
    });
  }
}

async function startWebSocketMonitoring(callId) {
  try {
    // Import WebSocket dynamically for Node.js environment
    const WebSocket = (await import('ws')).default;
    
    const ws = new WebSocket(`wss://api.openai.com/v1/realtime?call_id=${callId}`, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    ws.on('open', () => {
      console.log(`WebSocket connected for call ${callId}`);
      
      // Send initial response to greet the caller
      ws.send(JSON.stringify({
        type: "response.create",
        response: {
          instructions: "Greet the caller warmly and ask how you can help them today. Detect their language and respond in the same language."
        }
      }));
    });

    ws.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        console.log(`Call ${callId} event:`, event.type);
        
        // Log important events
        if (event.type === 'input_audio_buffer.speech_started') {
          console.log(`Call ${callId}: Customer started speaking`);
        } else if (event.type === 'input_audio_buffer.speech_stopped') {
          console.log(`Call ${callId}: Customer stopped speaking`);
        } else if (event.type === 'response.audio_transcript.done') {
          console.log(`Call ${callId}: AI response: ${event.transcript}`);
        } else if (event.type === 'input_audio_buffer.transcription.completed') {
          console.log(`Call ${callId}: Customer said: ${event.transcript}`);
        }
      } catch (error) {
        console.error(`Call ${callId} WebSocket message error:`, error);
      }
    });

    ws.on('error', (error) => {
      console.error(`Call ${callId} WebSocket error:`, error);
    });

    ws.on('close', () => {
      console.log(`Call ${callId} WebSocket closed`);
    });

  } catch (error) {
    console.error(`Failed to start WebSocket monitoring for call ${callId}:`, error);
  }
}