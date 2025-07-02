# AutoVP

## Setup

### Server side

Install [uv](https://docs.astral.sh/uv/).

Install dependencies.
```bash
uv sync
```

Build the python runner image.
```bash
docker build -f PythonRunnerDockerfile -t python-runner .
```

Edit `server/.env` config file.

Run the server.
```bash
uv run uvicorn main:app --reload
```

### Client side

Install dependencies.
```bash
pnpm install
```

Edit `client/src/lib/config.ts` config file.

Run the client.
```bash
pnpm dev
```