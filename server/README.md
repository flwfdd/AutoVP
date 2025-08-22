# Server

## How to Use

Before launching the server, make sure you have Python (>= 3.12) and [uv](https://docs.astral.sh/uv/) installed.

Install dependencies:
```bash
uv sync
```

Build the python runner image in `./docker`:
```bash
docker build -f PythonRunnerDockerfile -t python-runner .
```

Edit `server/.env` config file.

Run the server:
```bash
uv run uvicorn main:app --reload
```
