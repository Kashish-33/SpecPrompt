# SpecPrompt — Prompt Regression Testing Platform

> A production-grade evaluation platform designed for testing, monitoring, and validating LLM prompts against regressions, output schema changes, and latency spikes.

---

##  Live Deployments

- **Web Application:** [https://spec-prompt-kappa.vercel.app](https://spec-prompt-kappa.vercel.app)
- **Interactive API Docs (Swagger):** [https://specprompt-api.onrender.com/docs](https://specprompt-api.onrender.com/docs)

---

##  Problem Overview

In production LLM applications, updating system prompts or switching models often causes subtle, unexpected regressions:
- Tone drift and unwanted verbose outputs.
- Breaking strict JSON schemas required by downstream microservices.
- Unexpected latency spikes and API cost explosions.
- Failure to enforce negative constraints (e.g., policy violations or hallucinated facts).

**SpecPrompt** brings test-driven development (TDD) discipline to prompt engineering. It allows teams to create regression test suites, validate assertions across test cases, and track accuracy, cost, and latency metrics in real time.

---

## Key Features

- **Automated Test Suites:** Group test cases, variables, system instructions, and multi-rule assertions into modular suites.
- **Assertion Engine:**
  - `contains` / `not_contains`: Verify policy enforcement and keyword exclusion.
  - `json_valid`: Ensure responses parse as valid JSON matching structural requirements.
  - `regex_match`: Validate exact syntax, patterns, and formats.
  - `max_length` / `latency`: Track token efficiency and performance SLAs.
- **Provider-Agnostic LLM Engine:** Seamlessly connects to fast inference endpoints (Groq LPU, OpenAI models).
- **Interactive Analytics Dashboard:** Real-time visibility into overall pass rates, recent execution logs, latency distribution, and cost estimates.
- **RESTful Architecture:** Fully exposed endpoints to easily plug regression tests into CI/CD pipelines (GitHub Actions).

---

## Tech Stack & Architecture

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React |
| **Backend API** | FastAPI, Pydantic v2, SQLAlchemy, Uvicorn |
| **Inference Layer** | Groq LPU Engine / OpenAI API Compatible |
| **Database** | SQLite (Local/Demo), PostgreSQL ready |
| **Deployment** | Vercel (Frontend SPA) + Render (Containerized Backend) |

---

##  Quickstart (Local Development)

### 1. Prerequisites
- Python 3.11 or higher
- Node.js 18+ and npm
- A free API key from [Groq Console](https://console.groq.com)

---

### 2. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install required packages
pip install -r requirements.txt

# Create your local environment file
cp .env.example .env

# Populate sample test suites and start server
python seed.py
uvicorn app.main:app --reload --port 8000

```

### 3. Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Setup local environment
cp .env.example .env

# Start Vite dev server
npm run dev

```

##  License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
