// Real OpenAI token service
export async function getEphemeralToken() {
  console.log('🔑 Requesting real OpenAI ephemeral token...')
  
  try {
    // Try local development endpoint first, then fallback to Netlify function
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const endpoint = isDev ? '/api/token' : '/.netlify/functions/token'
    
    const response = await fetch(endpoint, {
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