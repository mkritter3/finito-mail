# Finito Mail

A blazing-fast email client with client-first architecture. 99% of operations happen in your browser with direct provider API access and local IndexedDB storage.

## Features

- ⚡ Lightning fast - All emails stored locally in IndexedDB
- 🔒 Privacy first - No server sees your emails
- 🌐 Works offline - Full access to all your emails
- ⌨️ Keyboard driven - Inspired by Superhuman
- 🔍 Natural language search - Powered by Gemini Flash
- ✅ Built-in todos - Convert emails to tasks
- 📦 Export anywhere - PST/MBOX/EML formats

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Storage**: IndexedDB with Dexie.js
- **Styling**: Tailwind CSS with Radix UI
- **State**: Zustand
- **Email Providers**: Gmail API (direct access)
- **Architecture**: Monorepo with Turborepo

## Getting Started

### Prerequisites

- Node.js 18+
- Google Cloud Console account for OAuth setup

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click Enable
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/auth/callback` (development)
     - `https://yourdomain.com/auth/callback` (production)
   - Copy the Client ID and Client Secret

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/finito-mail.git
cd finito-mail
```

2. Install dependencies:
```bash
npm install --legacy-peer-deps
```

3. Configure environment variables:
```bash
cd apps/web
cp .env.local.example .env.local
```

Edit `.env.local` with your Google OAuth credentials:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
finito-mail/
├── apps/
│   └── web/              # Next.js web application
├── packages/
│   ├── types/           # TypeScript type definitions
│   ├── storage/         # IndexedDB abstraction layer
│   ├── crypto/          # Encryption utilities
│   ├── provider-client/ # Email provider clients
│   ├── ui/             # Shared UI components
│   └── core/           # Core business logic
└── workers/            # Web workers for background tasks
```

## Development

### Running in development mode:
```bash
npm run dev
```

### Building for production:
```bash
npm run build
```

### Type checking:
```bash
npm run type-check
```

## Architecture

Finito Mail uses a client-first architecture:

1. **Authentication**: OAuth PKCE flow for secure browser-based auth
2. **Storage**: All emails stored in IndexedDB (50GB+ capacity)
3. **Sync**: Direct provider API access, no server middleware
4. **Search**: Local full-text search with AI enhancement
5. **Privacy**: End-to-end encryption for sensitive data

## Keyboard Shortcuts

- `Cmd/Ctrl + K` - Command palette
- `Cmd/Ctrl + /` - Show all shortcuts
- `C` - Compose new email
- `R` - Reply to email
- `A` - Reply all
- `F` - Forward email
- `E` - Archive email
- `#` - Delete email
- `T` - Toggle todo panel
- `\` - Search
- `J/K` - Navigate emails
- `X` - Select email
- `Cmd/Ctrl + A` - Select all
- `Escape` - Close panels

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see LICENSE file for details