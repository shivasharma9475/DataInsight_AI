# DataInsight AI (MERN + Python ML microservice)

**Upload Any Dataset. Get Instant AI-Powered Insights.**

This is the MERN-stack rebuild of DataInsight AI, using the same architecture pattern as **InventoryPro**: a Node/Express/MongoDB web app, with a small internal Python service handling the data-science work that Node's ecosystem isn't built for.

---

## Architecture

```
┌─────────────┐      ┌──────────────────┐      ┌────────────────────┐
│   React     │ ───▶ │  Node / Express   │ ───▶ │  Python ML Service │
│  (frontend) │ ◀─── │  (backend, :5000) │ ◀─── │  (internal, :8001) │
└─────────────┘      └────────┬──────────┘      └────────────────────┘
                               │
                               ▼
                         ┌──────────┐
                         │ MongoDB  │
                         └──────────┘
```

- **Frontend** (React/Vite/Tailwind) — talks only to the Node backend. Unchanged UI/UX from the original build.
- **Backend** (Node/Express/Mongoose) — the public-facing app. Owns **auth** (JWT, bcrypt, optional Google OAuth), **users and dataset ownership** (MongoDB), **file upload handling**, **chat history**, and the **optional OpenAI enhancement layer**. It never does data science itself — it forwards those requests to the ML service.
- **ML Service** (Python/FastAPI) — **internal only**, not reachable from the browser. Handles schema detection, cleaning, EDA, outlier detection, chart data, AutoML (classification/regression/clustering/forecasting), local AI insight/chat generation, and PDF/Excel report generation. Protected by a shared-secret header (`x-internal-key`) that only the Node backend knows.
- **MongoDB** — stores users, dataset ownership/metadata, and chat history. The actual dataset content is cached as Parquet files inside the ML service (`ml-service/uploads/<dataset_id>/`), not in Mongo — keeps things fast without needing a data warehouse.

### Why not pure Node for the ML parts?

Node doesn't have an equivalent to pandas/scikit-learn/statsmodels mature enough for real EDA, AutoML, and forecasting. Splitting the data-science workload into its own internal Python service — rather than forcing it into JS — is a standard pattern for exactly this reason, and it's the same choice already made in InventoryPro's demand-forecasting microservice.

---

## Quick start (Docker — recommended)

```bash
cp backend/.env.example backend/.env
cp ml-service/.env.example ml-service/.env
# Make sure INTERNAL_API_KEY matches in both .env files — this is the shared
# secret the Node backend uses to call the ML service.

docker compose up --build
```

- Frontend: http://localhost:5173
- Node API: http://localhost:5000
- ML service (internal, for debugging only): http://localhost:8001/docs

Upload `sample_data/sales_sample.csv` after signing up to see every feature in action.

---

## Quick start (manual / no Docker)

### 1. MongoDB
```bash
docker run -d -p 27017:27017 mongo:7
```
(or install locally, or use MongoDB Atlas)

### 2. ML service (Python)
```bash
cd ml-service
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8001
```

### 3. Backend (Node)
```bash
cd backend
npm install
cp .env.example .env
# make sure INTERNAL_API_KEY matches ml-service/.env
npm run dev
```

### 4. Frontend
```bash
cd frontend
npm install
cp .env.example .env             # VITE_API_URL=http://localhost:5000
npm run dev
```

Visit http://localhost:5173.

---

## Project structure

```
datainsight-mern/
├── backend/                     # Node/Express — public-facing app
│   ├── src/
│   │   ├── config/               # env, MongoDB connection
│   │   ├── models/                # User, Dataset, ChatMessage (Mongoose)
│   │   ├── middleware/            # JWT auth, error handler
│   │   ├── controllers/           # auth, datasets, ml, ai, chat, reports
│   │   ├── routes/
│   │   └── services/              # mlClient (calls ML service), aiEnhancer (OpenAI)
│   └── server.js
├── ml-service/                  # Python/FastAPI — internal data science service
│   └── app/
│       ├── services/               # data_processing, ml_engine, ai_engine, report_engine
│       └── main.py
├── frontend/                    # React/Vite/Tailwind — unchanged
├── sample_data/sales_sample.csv
└── docker-compose.yml
```

## API contract

The Node backend exposes the **same `/api/...` routes** as the original all-Python version (auth, datasets, ml, ai, chat, reports) — the frontend didn't need route-level changes, only its `VITE_API_URL` default port (5000 instead of 8000).

## What was actually tested

- The ML service was tested with **live HTTP requests** end-to-end: ingest → clean → EDA → run a regression model → chat query → AI insights → PDF report generation. All passed against a real 500-row sample dataset.
- The Node backend passes `node --check` on every file and its full import/module graph loads without error (verified by running the server against an intentionally unreachable Mongo URI — it fails only at the DB-connection step, which is the expected failure point in a sandbox with no MongoDB available).
- **Not verified in this environment:** a full browser click-through (signup → upload → dashboard) against the live Node backend, since no MongoDB instance was available here to connect to. The controller logic is a close, direct mirror of the FastAPI version's logic, which *was* fully tested — but treat the first real run as the true first test of the Node↔Mongo↔ML-service wiring, and check the console logs on all three services if something doesn't come back as expected.

## Known scope notes

Same as the original build — this intentionally prioritized the data pipeline (ML service) as the deep, fully-real part:
- No email-sending integration for password resets (reset link is logged to the Node console — wire up SendGrid/SES for production).
- Google OAuth works if you supply real credentials in `backend/.env`, but isn't required to use the app.
- Dataset files are cached to local disk inside the ML service container rather than object storage (S3/GCS) — fine for local/demo use.
