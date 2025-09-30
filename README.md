# ASJ Call Center - OpenAI Realtime API with SIP

A professional call center application using **OpenAI's official Realtime API with SIP** for intelligent multilingual support and in-app calling.

## Features

- **OpenAI Realtime API**: Official SIP integration with OpenAI
- **In-App Calling**: Call between users within the application
- **AI-Powered Conversations**: OpenAI GPT-4 handles all customer calls
- **Auto Language Detection**: AI detects caller's language automatically
- **Real-time Translation**: Supports Marathi, Spanish, English, Hindi, French, German
- **Webhook Integration**: Handles incoming calls via OpenAI webhooks
- **Call Control**: Accept, reject, transfer, and hangup calls programmatically

## Quick Start

### 1. Configure OpenAI Webhook
- Go to [platform.openai.com](https://platform.openai.com)
- Settings → Project → Webhooks
- Create webhook: `https://your-domain.com/api/openai-webhook`
- Select event: `realtime.call.incoming`
- Get your Project ID from Settings → Project → General

### 2. Set Environment Variables
```
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_WEBHOOK_SECRET=your_webhook_secret
OPENAI_PROJECT_ID=proj_your_project_id
```

### 3. Point SIP Provider to OpenAI
Configure your SIP provider to forward calls to:
```
sip:proj_PXdQACn4cQHgYaKFV9O2SuoF@sip.api.openai.com;transport=tls
```

### 4. Test In-App Calling
- Create caller and agent accounts
- Use the in-app calling feature
- AI provides real-time translation between users

## Architecture

### Webhook Flow
1. **Incoming Call** → OpenAI SIP endpoint receives call
2. **Webhook Fired** → `realtime.call.incoming` event sent to your app
3. **Call Accepted** → App accepts call with AI configuration
4. **WebSocket Connection** → Monitor call events in real-time
5. **AI Conversation** → GPT-4 handles multilingual conversation

### In-App Calling
1. **User Selection** → Choose user to call within app
2. **SIP Connection** → Route through OpenAI Realtime API
3. **AI Translation** → Real-time language translation
4. **Call Controls** → Mute, hangup, transfer functionality

## Supported Languages

- Marathi (मराठी)
- Spanish (Español)
- English
- Hindi (हिन्दी)
- French (Français)
- German (Deutsch)

## API Endpoints

### Webhook Handler
- **POST** `/api/openai-webhook` - Handles incoming call events
- Accepts calls automatically with multilingual AI configuration
- Starts WebSocket monitoring for call events

### Call Control
- **POST** `/api/openai-call-control` - Control active calls
- Actions: `hangup`, `reject`, `refer`
- Integrates with OpenAI's call control APIs

## WebSocket Events

Monitor call events via WebSocket connection:
- `input_audio_buffer.speech_started` - Customer started speaking
- `input_audio_buffer.transcription.completed` - Speech transcribed
- `response.audio_transcript.done` - AI response completed
- Connection: `wss://api.openai.com/v1/realtime?call_id={call_id}`

## Database Schema

### User Profiles
- `id` (uuid) - User identifier
- `email` (text) - User email
- `role` (text) - 'caller' or 'agent'
- `name` (text) - Display name
- `language` (text) - Preferred language

### Call Sessions
- `id` (uuid) - Session identifier
- `caller_id` (uuid) - Calling user
- `agent_id` (uuid) - Receiving user
- `status` (text) - Call status
- `caller_language` (text) - Caller's language
- `agent_language` (text) - Agent's language
- `duration` (integer) - Call duration in seconds

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