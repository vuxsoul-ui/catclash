# Claude Proxy (Railway)

## Required env vars
- `ANTHROPIC_API_KEY`

## Optional env vars
- `ANTHROPIC_BASE_URL`
- `CLAUDE_PROXY_TOKEN`
- `CLAUDE_MODEL` (default: `claude-sonnet-4-20250514`)
- `CLAUDE_MAX_TOKENS` (default: `1600`)
- `MAX_IMAGE_FILES` (default: `8`)
- `MAX_IMAGE_BYTES` (default: `8388608`)

## Endpoints
- `GET /health`
- `POST /v1/messages` (multipart/form-data)
