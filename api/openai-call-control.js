export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, call_id, target_uri } = req.body;

  if (!call_id) {
    return res.status(400).json({ error: 'call_id is required' });
  }

  const AUTH_HEADER = {
    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  };

  try {
    let endpoint;
    let body = {};

    switch (action) {
      case 'hangup':
        endpoint = `https://api.openai.com/v1/realtime/calls/${call_id}/hangup`;
        break;
      case 'reject':
        endpoint = `https://api.openai.com/v1/realtime/calls/${call_id}/reject`;
        body = { status_code: 486 }; // Busy
        break;
      case 'refer':
        if (!target_uri) {
          return res.status(400).json({ error: 'target_uri is required for refer action' });
        }
        endpoint = `https://api.openai.com/v1/realtime/calls/${call_id}/refer`;
        body = { target_uri };
        break;
      default:
        return res.status(400).json({ error: 'Invalid action. Use: hangup, reject, or refer' });
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${await response.text()}`);
    }

    console.log(`Call ${call_id} ${action} successful`);
    res.status(200).json({ success: true, action, call_id });

  } catch (error) {
    console.error(`Call control error:`, error);
    res.status(500).json({ 
      error: 'Call control failed',
      details: error.message 
    });
  }
}