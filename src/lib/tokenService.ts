// Real OpenAI token service
export async function getEphemeralToken() {
  console.log('🔑 Requesting real OpenAI ephemeral token...')
  
  try {
    const response = await fetch('/.netlify/functions/token', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('✅ Got real OpenAI ephemeral token')
    return data
  } catch (error) {
    console.error('❌ Failed to get ephemeral token:', error)
    throw error
  }
}