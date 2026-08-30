# IntelliInterview

An AI-powered mock interview and candidate assessment platform designed to help students and job seekers practice interviews, receive feedback, and track improvement over time.

## Overview

IntelliInterview lets candidates create an account, upload a resume, provide a job description, and participate in a mock interview with personalized questions. After an interview, the platform evaluates answers and provides a performance report. This repository now has a PostgreSQL-backed backend with real JWT authentication and a React frontend connected to it.

## Current Features

- **Landing Page** — project overview and calls to action
- **Authentication** — registration, login, logout, and protected routes with JWT
- **Candidate Dashboard** — welcome section, dynamic stats, quick actions, recent interviews
- **Resume Page** — PDF upload and mock analysis display
- **Job Description Page** — create, list, and delete job descriptions with mock analysis
- **Interview Setup** — select difficulty, type, question count, and duration
- **Mock Interview** — question-by-question interface with progress tracking, timer, and state management
- **Interview Result** — mock evaluation report with scores, strengths, and improvement areas
- **Interview History** — list of previous attempts retrieved from the database
- **Profile Page** — view and edit candidate details
- **FastAPI Backend** — REST API with health, auth, resume, job description, and interview endpoints
- **PostgreSQL Persistence** — SQLModel models with asyncpg and Alembic migrations
- **JWT Security** — password hashing and access-token authentication
- **AI Service Abstraction** — mock AI implementation ready to be replaced with a real provider

## Tech Stack

### Frontend

- React.js 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios

### Backend

- Python 3.10+
- FastAPI
- Pydantic / Pydantic Settings
- Uvicorn
- SQLModel
- SQLAlchemy 2.x (async)
- Alembic
- asyncpg (PostgreSQL driver)
- PyJWT
- pwdlib (password hashing)
- pytest / pytest-asyncio

### Database

- PostgreSQL

### AI (Planned)

- Google Gemini API
- Sentence Transformers
- RAG / vector search where required

## Project Structure

```text
AI-Mock-Interview-Platform/
├── .gitignore
├── AGENTS.md
├── README.md
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── pytest.ini
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/            # database migrations
│   ├── app/
│   │   ├── main.py
│   │   ├── api/v1/              # FastAPI routers
│   │   ├── core/                # config, security
│   │   ├── db/                  # async engine and session
│   │   ├── models/              # SQLModel models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── services/            # business logic + queries
│   │   └── utils/
│   └── tests/
└── frontend/
    ├── .env.example
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        ├── contexts/              # AuthContext
        ├── types/
        ├── utils/mockData.ts
        ├── services/              # API service layer
        ├── components/            # reusable UI and auth components
        ├── layouts/               # dashboard and auth layouts
        └── pages/                 # route pages
```

## Running Locally

### 1. Clone the repository

```bash
cd /path/to/AI-Mock-Interview-Platform
```

### 2. PostgreSQL setup

Create a PostgreSQL database and user. For example:

```sql
CREATE DATABASE intelliinterview;
CREATE DATABASE intelliinterview_test;
```

### 3. Backend setup

Create and activate a Python virtual environment, then install dependencies.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # On Windows
pip install -r requirements.txt
```

Copy the example environment file and set the real values:

```bash
copy .env.example .env      # On Linux/macOS: cp .env.example .env
```

Edit `backend/.env`:

```text
DATABASE_URL=postgresql+asyncpg://username:password@localhost:5432/intelliinterview
DATABASE_URL_TEST=postgresql+asyncpg://username:password@localhost:5432/intelliinterview_test
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:5173
```

Run Alembic migrations to bring the schema to the latest version:

```bash
alembic upgrade head
```

Start the backend:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

Example health check:

```bash
curl http://localhost:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "IntelliInterview API"
}
```

Run the backend tests:

```bash
pytest
```

### 4. Frontend setup

In a separate terminal, install dependencies and run the Vite dev server.

```bash
cd ../frontend
copy .env.example .env      # On Linux/macOS: cp .env.example .env
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173` by default.

### 5. Basic user flow

1. Open the landing page at `/`
2. Navigate to `/login` or `/register`
3. Go to `/dashboard`
4. Upload a resume at `/resume`
5. Add a job description at `/job-description`
6. Configure an interview at `/interview/setup`
7. Start the interview at `/interview`
8. Answer or skip questions, then end the interview
9. View the report at `/interview/result`
10. View history at `/interviews`

## Database Migrations

All schema changes must be implemented through Alembic migrations. Do **not** use `SQLModel.metadata.create_all()` or `Base.metadata.create_all()` inside the application. Never create or alter tables manually.

The final database stack is:

- **ORM:** SQLModel
- **PostgreSQL driver:** asyncpg
- **Migrations:** Alembic

Migration workflow:

```
Modify SQLModel model
   |
   v
alembic revision --autogenerate -m "describe change"
   |
   v
Review the generated migration
   |
   v
alembic upgrade head
```

## Current Status

The application now uses a real PostgreSQL database for persistence and JWT-based authentication. The frontend is connected to the backend API for user data, resumes, job descriptions, interviews, and results. AI logic is still mocked through `AIService` and `EvaluationService` and will be replaced with a real AI provider in a later phase.

## Future Scope

- Google Gemini integration
- Resume AI analysis
- Job description AI analysis
- Resume–JD matching
- AI-generated personalized interview questions
- Adaptive mock interviews
- AI answer evaluation and feedback
- Performance analytics and improvement tracking
- Voice interviews
- Coding interviews

## License

This is an academic project for study purposes. All rights reserved by the project team.
