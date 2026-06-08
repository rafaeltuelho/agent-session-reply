# Augment Session Replay

A Next.js application for uploading, storing, and replaying Augment AI conversation sessions with an interactive turn-by-turn playback interface.

## Features

- **📤 Session Loading**: Load any Augment session JSON files via drag-and-drop or file picker
- **▶️ Interactive Replay**: Navigate through conversation turns with playback controls
- **🔄 Turn Grouping**: Intelligent grouping of raw exchanges into logical conversation turns
- **🎨 Rich Markdown**: Full markdown support with syntax highlighting for code blocks
- **🌙 Dark Theme**: GitHub-inspired dark theme optimized for readability
- **🔍 Tool Call Inspection**: Expandable panels to view tool calls and their results

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org) 16.1.6 (App Router)
- **Runtime**: React 19.2.3
- **Language**: TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 4
- **Markdown**: react-markdown with remark-gfm and react-syntax-highlighter
- **Font**: JetBrains Mono (monospace)

## Getting Started

### Prerequisites

- Node.js 20+ or compatible runtime
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd augment-session-replay
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm run start
```

## Project Structure

```
augment-session-replay/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout with SessionProvider
│   │   ├── page.tsx            # Home page with session list
│   │   └── globals.css         # Global styles
│   ├── components/             # React components
│   │   ├── SessionList.tsx     # Session upload and list
│   │   ├── SessionReplay.tsx   # Main replay interface
│   │   ├── PlaybackControls.tsx # Navigation controls
│   │   ├── Timeline.tsx        # Visual timeline
│   │   ├── TurnCard.tsx        # Individual turn display
│   │   ├── ToolCallPanel.tsx   # Tool call details
│   │   ├── ThinkingBlock.tsx   # Thinking indicator
│   │   └── MarkdownRenderer.tsx # Markdown with syntax highlighting
│   └── lib/
│       ├── parser/             # Session parsing logic
│       ├── schema/             # TypeScript type definitions
│       └── session-context.tsx # React context for session state
├── sessions/                   # Uploaded session files (gitignored)
└── specs/                      # Technical specifications
    └── encryption-at-rest.md   # Encryption proposal
```

## How It Works

### Turn Grouping

The application intelligently groups raw message exchanges into logical "turns":
- Each turn starts with a user message
- Includes all subsequent tool calls and agent responses
- Provides a natural conversation flow for replay

### Session Storage

- Sessions are uploaded via the `/api/sessions/upload` endpoint
- Stored as JSON files in the `/sessions` directory
- Retrieved via the `/api/sessions` endpoint
- **Note**: Currently unencrypted; see `specs/encryption-at-rest.md` for planned security enhancements

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Key Components

- **SessionProvider**: Global state management for session data
- **SessionReplay**: Main replay interface with turn navigation
- **MarkdownRenderer**: Handles rich text rendering with code syntax highlighting
- **PlaybackControls**: Turn-by-turn navigation UI

## Roadmap

- [ ] Encryption at rest for session data
- [ ] Session search and filtering
- [ ] Export functionality
- [ ] Session sharing capabilities
- [ ] Performance optimizations for large sessions

## Contributing

Contributions are welcome! Please ensure:
- TypeScript strict mode compliance
- Consistent code formatting
- Component documentation

## License

[Add your license here]
