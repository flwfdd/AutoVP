# AutoVP

## Getting Started

### Quick Start

The easiest way to get started is to use the startup script:

```bash
bash start.sh
```

This script will:
- Check that [Node.js](https://nodejs.org/), [Python](https://www.python.org/downloads/), [pnpm](https://pnpm.io/), and [uv](https://docs.astral.sh/uv/) are installed
- Install frontend and backend dependencies
- Build Python docker image for backend
- Start both the client and server automatically
- Open the application at http://localhost:5173/

### Manual Setup

If you prefer to launch the components manually:

- See [`./client/README.md`](./client/README.md) for how to setup the client.
- See [`./server/README.md`](./server/README.md) for how to setup the server.
