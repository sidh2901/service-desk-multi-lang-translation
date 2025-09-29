import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const apiKey = process.env.TWILIO_API_KEY
const apiSecret = process.env.TWILIO_API_SECRET
const appSid = process.env.TWILIO_APP_SID

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { identity, role } = req.body

    if (!identity || !role) {
      return res.status(400).json({ error: 'Identity and role required' })
    }

    // Create access token
    const AccessToken = twilio.jwt.AccessToken
    const VoiceGrant = AccessToken.VoiceGrant

    const accessToken = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: identity,
      ttl: 3600 // 1 hour
    })

    // Create voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: appSid,
      incomingAllow: role === 'agent' // Only agents can receive calls
    })

    accessToken.addGrant(voiceGrant)

    res.status(200).json({
      accessToken: accessToken.toJwt(),
      identity: identity
    })

  } catch (error) {
    console.error('Error creating Twilio token:', error)
    res.status(500).json({ 
      error: 'Failed to create access token',
      details: error.message 
    })
  }
}