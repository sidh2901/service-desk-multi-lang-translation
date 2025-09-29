# ASJ Call Center - Direct SIP + AI Translation

A professional call center application with **Direct SIP calling** + OpenAI's Realtime API for intelligent multilingual support.

## Features

- **Direct SIP Calling**: No phone number needed - call directly via SIP clients
- **AI-Powered Conversations**: OpenAI GPT-4 handles all customer calls
- **Auto Language Detection**: AI detects caller's language automatically
- **Real-time Translation**: Supports Marathi, Spanish, English, Hindi, French, German
- **Professional Setup**: Real phone calls, not just web-based chat
- **Instant Testing**: Set up and test in 5 minutes with any SIP client

## Quick Start

### 1. Download a SIP Client
- **Zoiper**: [zoiper.com](https://www.zoiper.com/en/voip-softphone/download/current) (Recommended)
- **Linphone**: [linphone.org](https://www.linphone.org/technical-corner/linphone) (Open Source)
- **3CX Phone**: [3cx.com](https://www.3cx.com/phone-system/clients/) (Business Grade)

### 2. Configure SIP Account
- **SIP Server**: `sip.api.openai.com`
- **Username**: `proj_PXdQACn4cQHgYaKFV9O2SuoF`
- **Password**: (leave empty)
- **Transport**: TLS (recommended)

### 3. Configure OpenAI Webhook (Optional)
- Go to [platform.openai.com](https://platform.openai.com)
- Settings → Project → Webhooks
- Create webhook: `https://your-domain.com/api/openai-webhook`
- Select event: `realtime.call.incoming`
- Get your Project ID from Settings → Project → General

### 4. Make a Test Call
- Use your SIP client to call: `sip:proj_PXdQACn4cQHgYaKFV9O2SuoF@sip.api.openai.com`
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

1. **Open SIP client** and dial the SIP URI
2. **AI answers instantly** and configures multilingual support  
3. **Speak in any language** - AI detects automatically
4. **Real-time conversation** with automatic translation
5. **AI responds** in the same language you spoke

## Cost Breakdown

- **SIP Client**: FREE (most are free)
- **OpenAI API**: ~$0.06/minute for voice + AI
- **Total**: Only pay for AI usage, no phone costs!

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