import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const response = await openai.beta.realtime.sessions.create({
      model: 'gpt-4o-realtime-preview-2024-12-17',
      voice: 'coral',
    });

    res.status(200).json(response);
  } catch (error) {
    console.error('Error creating ephemeral token:', error);
    res.status(500).json({ 
      error: 'Failed to create ephemeral token',
      details: error.message 
    });
  }
}