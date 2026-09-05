# IntelliInterview

An AI-powered mock interview and candidate assessment platform designed to help students and job seekers practice interviews, receive feedback, and track improvement over time.

## Overview

IntelliInterview lets candidates create an account, upload a resume, provide a job description, and participate in a mock interview with personalized questions. After an interview, the platform evaluates answers and provides a performance report. The backend is a FastAPI application backed by PostgreSQL, and the React frontend connects to it over a versioned REST API.

## Current Features

### Authentication

- Registration, login, logout, current user, and protected routes with JWT
- Password hashing with pwdlib / bcrypt

### Resume Management

- Real PDF upload with multipart form data
- File type and size validation (10 MB max)
- PDF text extraction using `pypdf`
- AI resume analysis via Google Gemini
- Structured storage of extracted text and analysis
- Resume list and latest-resume retrieval

### Job Description Management

- Create, list, and delete job descriptions
- AI JD analysis via Google Gemini
- Structured extraction of required/preferred skills, technologies, responsibilities, experience, education, and keywords

### Resume ↔ Job Description Matching

- AI-powered compatibility analysis
- Overall match score (0–100) with validation
- Matched skills, missing skills, strengths, gaps, and recommendations
- Persisted per user/resume/JD combination

### Interview Lifecycle

- Interview setup with resume, JD, difficulty, question count, duration, and question types
- Ownership validation on resume and JD
- AI-generated personalized questions using structured Gemini outputs
- Question-by-question interview interface with progress, timer, and state management
- Answer submission and interview completion
- Interview history and result reporting

### AI Provider

- Google Gemini integration using the `google-genai` SDK
- Centralized `AIService` abstraction with a `GeminiProvider` implementation
- Structured Pydantic outputs for resume analysis, JD analysis, match analysis, and interview questions
- Configurable model and timeout via environment variables
- Application-level error handling for AI failures, missing keys, timeouts, and invalid outputs

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
- google-genai (Gemini SDK)
- pypdf (PDF text extraction)
- pytest / pytest-asyncio

### Database

- PostgreSQL

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

Create PostgreSQL databases for development and testing:

```sql
CREATE DATABASE intelliinterview;
CREATE DATABASE intelliinterview_test;
```

### 3. Backend setup

Create and activate a Python virtual environment, then install dependencies:

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
CORS_ORIGINS=http://localhost:8080
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.6-flash
```

> Never commit real API keys or secrets. Keep `GEMINI_API_KEY` in `backend/.env` only.

Run Alembic migrations to bring the schema to the latest version:

```bash
alembic upgrade head
```

Start the backend:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

Health check:

```bash
curl http://localhost:8000/health
```

Run backend tests:

```bash
pytest
```

### 4. Frontend setup

In a separate terminal, install dependencies and run the Vite dev server:

```bash
cd ../frontend
copy .env.example .env      # On Linux/macOS: cp .env.example .env
npm install
npm run dev
```

The frontend will be available at `http://localhost:8080` by default. Make sure `CORS_ORIGINS` in `backend/.env` includes this origin.

### 5. Basic user flow

1. Open the landing page at `/`
2. Navigate to `/login` or `/register`
3. Go to `/dashboard`
4. Upload a real text-based PDF resume at `/resume`
5. Add a job description at `/job-description`
6. Use the match panel on the job-description page to compare a resume with a JD
7. Configure an interview at `/interview/setup` by selecting the resume and JD
8. Start the interview at `/interview`
9. Answer or skip questions, then end the interview
10. View the report at `/interview/result`
11. View history at `/interviews`

## AI Features

### Resume AI Analysis

When a PDF is uploaded, the backend extracts its text and asks Gemini to produce a structured analysis:

- Professional summary
- Technical skills, soft skills, programming languages, frameworks, and tools
- Education, experience, projects, and certifications
- Strengths and areas for improvement

The result is validated against a Pydantic schema, stored in the database, and returned to the frontend. Resume analysis is performed on upload and is not regenerated on every page load.

### Job Description AI Analysis

When a JD is created, Gemini extracts:

- Job title
- Required and preferred skills
- Technologies
- Responsibilities
- Experience and education requirements
- Important keywords

The analysis is validated, persisted, and displayed on the job-description page.

### Resume ↔ JD Matching

The match endpoint sends the stored resume analysis and JD analysis to Gemini and returns:

- Overall match score (0–100), validated to remain in range
- Matched skills, missing skills
- Strengths relative to the role
- Gaps to address
- Actionable recommendations

Match results are stored per user/resume/JD to avoid duplicate analysis.

### AI Interview Question Generation

When an interview is created, the backend sends the resume analysis, JD analysis, and interview configuration to Gemini and receives a structured list of questions. Each question includes:

- Question text
- Question type (`technical`, `behavioral`, `situational`, `HR`)
- Difficulty (`easy`, `medium`, `hard`)
- Topic and expected focus

Questions are personalized based on the candidate's background and the JD, then persisted as `interview_questions` rows.

## Error Handling

- Missing or invalid Gemini API key returns `503 Service Unavailable` with a generic message
- Gemini timeouts return `504 Gateway Timeout`
- Invalid or unparseable model outputs return `502 Bad Gateway`
- Empty or non-extractable PDFs return `422 Unprocessable Entity`
- Unsupported file types return `400 Bad Request`
- API keys and stack traces are never exposed to the frontend

## PDF Limitations

- Only text-based PDFs are supported in this phase
- Scanned image resumes without a text layer are rejected with a clear message
- Maximum upload size is 10 MB
- Only `.pdf` files are accepted

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
Rename the generated script to the next sequential number, e.g. `0002_...
   |
   v
alembic upgrade head
```

## Testing

Backend tests use a dedicated test database (`DATABASE_URL_TEST`) and a deterministic fake Gemini provider so no real network calls are required.

Run the test suite:

```bash
cd backend
pytest
```

Frontend build verification:

```bash
cd frontend
npm run build
```

## Verification Checklist

Backend:

- `python -m compileall app`
- `alembic history`
- `alembic current`
- `alembic upgrade head`
- `pytest`

Frontend:

- `npm run build`

## Current Status

Phase 4 is implemented. The platform is now genuinely AI-powered with Google Gemini for resume analysis, JD analysis, resume-JD matching, and personalized interview question generation. The production flow no longer depends on mock AI data, although a `mockData.ts` file is retained for isolated UI development.

## Future Scope

- AI answer evaluation and feedback
- Adaptive mock interviews
- Performance analytics and improvement tracking
- Voice interviews
- Speech-to-text / text-to-speech
- Coding interviews
- RAG and vector search

## License

This is an academic project for study purposes. All rights reserved by the project team.
