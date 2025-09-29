# ASJ Call Center - Google Voice + AI Translation

A professional call center application with **FREE Google Voice number** + OpenAI's Realtime API for intelligent multilingual support.

## Features

- **FREE Phone Number**: Get a real business number with Google Voice (no monthly fees!)
- **AI-Powered Conversations**: OpenAI GPT-4 handles all customer calls
- **Auto Language Detection**: AI detects caller's language automatically
- **Real-time Translation**: Supports Marathi, Spanish, English, Hindi, French, German
- **Professional Setup**: Real phone calls, not just web-based chat
- **Zero Monthly Costs**: Completely free phone number + pay-per-use AI

## Quick Start

### 1. Get Your Free Google Voice Number
- Go to [voice.google.com](https://voice.google.com)
- Sign up with your Google account
- Choose a free phone number
- Verify with your existing phone

### 2. Configure OpenAI Webhook
- Go to [platform.openai.com](https://platform.openai.com)
- Settings → Project → Webhooks
- Create webhook: `https://your-domain.com/api/openai-webhook`
- Select event: `realtime.call.incoming`
- Get your Project ID from Settings → Project → General

### 3. Forward Google Voice to OpenAI SIP
- In Google Voice settings → Calls → Call forwarding
- Add: `sip:proj_PXdQACn4cQHgYaKFV9O2SuoF@sip.api.openai.com`

### 4. Test Your Setup
- Call your Google Voice number from any phone
- Speak in Marathi, Spanish, or English
- AI detects your language and responds appropriately!

## Environment Variables

Add these to your deployment:

```
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_WEBHOOK_SECRET=your_webhook_secret
OPENAI_PROJECT_ID=proj_your_project_id
```

## Supported Languages

- Marathi (मराठी)
- Spanish (Español)
- English
- Hindi (हिन्दी)
- French (Français)
- German (Deutsch)

## How It Works

1. **Customer calls** your Google Voice number (free!)
2. **Google Voice forwards** call to OpenAI SIP endpoint
3. **OpenAI webhook fires** to your application
4. **AI accepts call** and configures multilingual support
5. **Real-time conversation** with automatic language detection
6. **AI responds** in the same language the customer speaks

## Cost Breakdown

- **Google Voice**: FREE (no monthly fees)
- **OpenAI API**: ~$0.06/minute for voice + AI
- **Total**: Much cheaper than traditional call centers!

## Features

- **Live Translation**: Real-time speech-to-speech translation
- **Call Controls**: Mute, hold, volume control
- **Transcript**: Download complete conversation logs
- **Professional Setup**: Real business phone number
- **Multi-language**: Auto-detection of 6+ languages
- **Voice Selection**: Multiple voice options

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## License

MIT License - see LICENSE file for details.