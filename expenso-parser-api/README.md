# Expenso Parser API — Production FastAPI Backend

High-performance, clean architecture FastAPI backend microservice for bank statement PDF parsing, OCR extraction, and transaction validation.

## Repository Architecture

```
app/
├── main.py              # Application entrypoint & middleware setup
├── config.py            # Pydantic BaseSettings environment configurations
├── dependencies.py      # Dependency injection providers
├── routes/              # API Endpoints (/healthz, /api/v1/parse, /api/v1/ocr)
├── services/            # Business orchestration services
├── parser/              # PDF text & bank layout extractors
├── ocr/                 # OCR preprocessing & Tesseract engines
├── validators/          # Statement & transaction validation rules
├── models/              # Pydantic v2 schemas
└── utils/               # Logger, date & currency formatters
```

## Running Locally

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run local development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

3. Open API docs:
   - Interactive Swagger UI: `http://localhost:8000/docs`
   - ReDoc UI: `http://localhost:8000/redoc`

## Docker & Render Deployment

### Deploying to Render

1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your Git repository containing `expenso-parser-api`.
3. Choose **Docker** as the Environment / Runtime (Render will automatically detect `Dockerfile`).
4. Set Environment Variables on Render:
   - `APP_ENV` = `production`
   - `DEBUG` = `false`
   - `PORT` = `8000`
   - `CORS_ORIGINS` = `https://your-frontend.vercel.app`
5. Click **Deploy**. Your API will be live at `https://expenso-parser-api.onrender.com`.

### Local Docker Run

```bash
docker-compose up -d --build
```
