# IntelliInterview

An AI-powered mock interview and candidate assessment platform that helps students and job seekers practice interviews, receive structured AI feedback, and track improvement over time.

## 1. Project Overview

IntelliInterview lets a candidate register, upload a PDF resume, add a job description (JD), get an AI-generated compatibility analysis, and run a full mock interview: personalized questions, per-answer AI evaluation, adaptive follow-up questions, and a final interview report. The backend is a FastAPI application backed by PostgreSQL; the React frontend talks to it over a versioned REST API (`/api/v1`).

## 2. Main Features

- **Authentication** — registration, login, logout, JWT-protected routes, bcrypt password hashing (pwdlib), per-user data isolation.
- **Resume management** — real PDF upload (multipart), type/size validation (PDF only, 10 MB max), text extraction via `pypdf`, and structured AI resume analysis persisted in the database.
- **Job descriptions** — create, list, and delete JDs with AI analysis (required/preferred skills, technologies, responsibilities, experience/education requirements, keywords).
- **Resume ↔ JD matching** — AI compatibility report with overall match score, matched/missing skills, strengths, gaps, and recommendations; one persisted match per user/resume/JD.
- **Mock interviews** — configurable difficulty, question count, duration, and question types; AI-generated personalized questions; per-question timer and progress bar.
- **Answer evaluation** — every submitted answer is evaluated by Gemini (score, per-dimension scores, strengths, weaknesses, missing points, improvement feedback, confidence, uncertainty notes).
- **Adaptive follow-ups** — when the evaluation flags `follow_up_required`, a contextual follow-up question is generated (capped by `MAX_FOLLOW_UP_QUESTIONS`).
- **Final report** — overall score plus technical, communication, relevance, and problem-solving scores; strengths, weaknesses, missing skills, preparation topics, and question-level feedback.
- **History** — interview history with per-interview reports and resume-from-history for unfinished interviews.

## 3. Technology Stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, React Router, Axios.

**Backend:** Python 3.10+, FastAPI, Pydantic / Pydantic Settings, Uvicorn, SQLModel, SQLAlchemy 2.x (async), Alembic, asyncpg, PyJWT, pwdlib, google-genai, pypdf, pytest / pytest-asyncio.

**Database:** PostgreSQL.

**AI:** Google Gemini via the `google-genai` SDK behind a `GeminiProvider` abstraction.

## 4. System Architecture

```
React SPA (Vite)  ──axios──▶  FastAPI /api/v1  ──▶  Services  ──▶  Queries/Repositories
        │                          │                    │                  │
        │                          ▼                    ▼                  ▼
   localStorage (JWT)      JWT auth dependency    AIService ──▶ Gemini   PostgreSQL
```

- `app/api/v1/` contains thin routers; all business logic lives in `app/services/`; data access in `*_query.py` modules and SQLModel models in `app/models/`.
- `AIService` (in `app/services/ai/`) is the single entry point for all AI work. It builds prompts, calls `AIProviderInterface.complete_json(prompt, schema)`, and returns validated Pydantic objects. `GeminiProvider` is selected via `AI_PROVIDER`.
- The frontend has a typed service layer (`src/services/`) that normalizes snake_case API responses; `api.ts` attaches the JWT and handles 401s globally.

## 5. Frontend and Backend Structure

```text
backend/
├── alembic/versions/        # numbered migrations (0001_... , 0004_...)
├── app/
│   ├── main.py              # app factory, CORS, exception handlers, logging
│   ├── exception.py         # CustomException
│   ├── logging.py           # setup_logging / get_logger
│   ├── api/v1/              # auth, resume, job, match, interview routers
│   ├── core/                # config (Settings), security (JWT, hashing)
│   ├── db/                  # async engine + session
│   ├── models/              # SQLModel tables
│   ├── schemas/             # Pydantic request/response models
│   ├── services/            # ai/, auth/, interview/, job/, match/, resume/
│   └── utils/response_utils/# response envelope + exception handlers
└── tests/                   # pytest suite with FakeGeminiProvider

frontend/src/
├── contexts/AuthContext.tsx # session state
├── services/                # api.ts + per-domain services
├── components/              # auth/, dashboard/, interview/, ui/
├── layouts/                 # AuthLayout, DashboardLayout (responsive)
└── pages/                   # Landing, Login, Register, Dashboard, Resume,
                             # JobDescription, InterviewSetup, Interview,
                             # InterviewResult, InterviewHistory, Profile
```

## 6. Database Architecture

- **ORM:** SQLModel · **Driver:** asyncpg · **DB:** PostgreSQL · **Migrations:** Alembic
- Tables: `users`, `resumes`, `job_descriptions`, `resume_job_matches`, `interviews`, `interview_questions`, `interview_answers`, `interview_results`.
- All user-scoped tables carry `user_id` foreign keys with `ON DELETE CASCADE`.
- `interview_answers` has a unique constraint on `(interview_id, question_id)` so duplicate submissions are rejected atomically.
- `interview_results` has a unique `interview_id` so `complete` is idempotent (a second call returns the existing report).

All schema changes go through Alembic — never `SQLModel.metadata.create_all()` in app code.

## 7. Authentication Flow

1. `POST /api/v1/auth/register` validates input (Pydantic bounds), hashes the password with bcrypt, and creates the user.
2. `POST /api/v1/auth/login` verifies credentials and returns a JWT (`sub` = user id, exp = `ACCESS_TOKEN_EXPIRE_MINUTES`).
3. The frontend stores the token in `localStorage` and attaches `Authorization: Bearer <token>` via an Axios request interceptor.
4. `get_current_user` decodes the token, loads the user, and rejects missing, invalid, expired, or inactive users.
5. On any non-auth 401 the frontend clears the session and redirects to `/login`.

## 8. Gemini Integration Flow

- `AIService` is constructed per request-scoped service and resolves its provider from `AI_PROVIDER` (`gemini` → `GeminiProvider`; anything else → 503).
- `GeminiProvider` reads `GEMINI_API_KEY` and `GEMINI_MODEL` from backend env only, requests `application/json` output constrained by a Pydantic `response_schema`, retries parse failures once, and maps failures to safe errors: 503 (not configured), 504 (timeout via `GEMINI_TIMEOUT`), 502 (invalid/failed response). Raw SDK errors are wrapped so keys and internals never leak.
- Tests never call Gemini: `tests/conftest.py` monkey-patches `GeminiProvider` with a deterministic `FakeGeminiProvider`.

## 9. Resume Analysis Flow

`UploadFile → extension check (.pdf) → size check (10 MB) → %PDF magic check → pypdf text extraction → AIService.analyze_resume → validated analysis + extracted text + skills stored → file saved under backend/uploads/resumes/ (sanitized filename) → ResumeResponse (no internal file path is returned).`

JD creation and matching follow the same pattern: text → prompt → structured Pydantic output → persisted on the record.

## 10. Interview and Evaluation Flow

1. `POST /interviews` validates resume/JD ownership, ensures cached analyses exist, then generates personalized questions; if question generation fails the orphan interview is deleted.
2. `POST /interviews/{id}/answers` validates ownership, interview status (not completed), question membership, answer length (≤ 20,000 chars), and duplicate submission (runtime check + DB unique constraint). The answer is evaluated by Gemini and stored on the answer row.
3. If the evaluation requests a follow-up and the cap is not reached, a follow-up `InterviewQuestion` is appended.
4. `POST /interviews/{id}/complete` requires at least one answer, generates the final report (with a safe fallback if the AI call fails), marks the interview `COMPLETED`, and is idempotent.

## 11. Required Environment Variables

Backend (`backend/.env`, see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/intelliinterview` |
| `DATABASE_URL_TEST` | Test database URL (pytest) |
| `JWT_SECRET_KEY` | **Required.** Secret for signing JWTs — no default |
| `JWT_ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `AI_PROVIDER` | `gemini` |
| `GEMINI_API_KEY` | Gemini API key (backend only, never exposed) |
| `GEMINI_MODEL` | e.g. `gemini-3.6-flash` |
| `GEMINI_TIMEOUT` | Per-request timeout in seconds (default 60) |
| `MAX_FOLLOW_UP_QUESTIONS` | Follow-up cap per interview (default 3) |

Frontend (`frontend/.env`): `VITE_API_BASE_URL=http://localhost:8000/api/v1`

## 12. PostgreSQL Setup

```sql
CREATE DATABASE intelliinterview;
CREATE DATABASE intelliinterview_test;
```

## 13. Alembic Migration Commands

```bash
cd backend
alembic revision --autogenerate -m "describe change"   # generate
# review the file, rename to the next 000N_<slug>.py
alembic upgrade head      # apply
alembic current           # show current revision
alembic history           # list revisions
alembic downgrade -1      # roll back one step
```

## 14. Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows (source .venv/bin/activate on Unix)
pip install -r requirements.txt
copy .env.example .env        # fill in real values
alembic upgrade head
uvicorn app.main:app --reload # http://localhost:8000
```

Health check: `curl http://localhost:8000/health`

## 15. Frontend Setup

```bash
cd frontend
copy .env.example .env
npm install
npm run dev                   # http://localhost:8080
```

## 16. Test Commands

```bash
cd backend
python -m compileall app   # syntax check
pytest                     # 19 tests; uses DATABASE_URL_TEST + fake Gemini
alembic current            # verify migration head

cd frontend
npm run build              # tsc + vite production build
```

## 17. Known Limitations

- Text-based PDFs only; scanned/image PDFs are rejected.
- The per-question timer is client-side and not enforced by the server.
- Interviews are text Q&A only — no voice, video, or coding rounds.
- Answer evaluation failures are tolerated (the answer is stored without an evaluation); report generation falls back to a safe degraded report.
- Resume files are stored on the local filesystem (`backend/uploads/`).
- Single-server deployment assumed; no external infrastructure is included.

## 18. Future Enhancements

- Voice/video interviews and speech-to-text
- Coding interview rounds
- RAG / vector search over question banks
- Richer analytics and progress tracking
- Cloud storage for uploaded resumes

## License

This is an academic project for study purposes. All rights reserved by the project team.
