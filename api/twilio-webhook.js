import twilio from 'twilio'

const VoiceResponse = twilio.twiml.VoiceResponse

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const twiml = new VoiceResponse()
    const { To, From, CallSid } = req.body

    console.log(`Incoming call: ${From} -> ${To}, CallSid: ${CallSid}`)

    // Route call to available agent
    const dial = twiml.dial({
      callerId: From,
      timeout: 30,
      record: 'record-from-answer'
    })

    // Find available agent (you can customize this logic)
    const availableAgent = await findAvailableAgent()
    
    if (availableAgent) {
      // Connect to agent's browser client
      dial.client(availableAgent.identity)
      
      // Log the call attempt
      console.log(`Routing call ${CallSid} to agent: ${availableAgent.identity}`)
    } else {
      // No agents available
      twiml.say('Sorry, all agents are currently busy. Please try again later.')
      twiml.hangup()
    }

    res.setHeader('Content-Type', 'text/xml')
    res.status(200).send(twiml.toString())

  } catch (error) {
    console.error('Webhook error:', error)
    
    const twiml = new VoiceResponse()
    twiml.say('Sorry, there was an error processing your call.')
    twiml.hangup()
    
    res.setHeader('Content-Type', 'text/xml')
    res.status(200).send(twiml.toString())
  }
}

async function findAvailableAgent() {
  // This would query your database for available agents
  // For now, return a mock agent
  return {
    identity: 'agent_001',
    name: 'Agent Smith'
  }
}