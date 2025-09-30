# ASJ Call Center - Clean & Simple

A clean, working call center application with AI-powered multilingual support.

## Features

- **User Authentication**: Secure login/signup with role-based access
- **Caller Dashboard**: Call available agents with language selection
- **Agent Dashboard**: Receive calls and manage availability
- **AI Translation**: Real-time language translation between users
- **Call Management**: Full call lifecycle with duration tracking
- **Database Integration**: Supabase for user profiles and call sessions

## Quick Start

### 1. Environment Setup
Create a `.env` file with:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_WEBHOOK_SECRET=your_webhook_secret
OPENAI_PROJECT_ID=proj_PXdQACn4cQHgYaKFV9O2SuoF
```

### 2. Database Schema
The app uses these Supabase tables:
- `user_profiles` - User information and roles
- `call_sessions` - Call tracking and history

### 3. User Roles
- **Caller**: Can call available agents
- **Agent**: Receives calls and manages availability

### 4. Supported Languages
- Marathi (मराठी)
- Spanish (Español)
- English
- Hindi (हिन्दी)
- French (Français)
- German (Deutsch)

## How It Works

### For Callers:
1. Login and select "Caller" role
2. Choose an available agent
3. Select your language
4. Start the call
5. AI provides real-time translation

### For Agents:
1. Login and select "Agent" role
2. Set availability status
3. Receive incoming call notifications
4. Answer calls and communicate
5. AI translates between languages

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Supabase (Database + Auth)
- **AI**: OpenAI Realtime API (future integration)
- **Deployment**: Bolt Hosting

## Demo Accounts

Create accounts with these patterns:
- Caller: `caller@demo.com` / `password`
- Agent: `agent@demo.com` / `password`

The system automatically assigns roles based on email patterns.

## License

MIT License