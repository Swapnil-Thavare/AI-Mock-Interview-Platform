# IntelliInterview

An AI-powered mock interview and candidate assessment platform designed to help students and job seekers practice interviews, receive feedback, and track improvement over time.

## Overview

IntelliInterview lets candidates upload a resume, provide a job description, and participate in a mock interview with personalized questions. After an interview, the platform evaluates answers and provides a performance report. This repository contains the initial foundation and a functional demonstrable prototype using mock data and services.

## Current Skeleton Features

- **Landing Page** — project overview and calls to action
- **Authentication Pages** — login and registration forms (mock, ready for real JWT)
- **Candidate Dashboard** — welcome section, quick stats, quick actions, recent interviews
- **Resume Page** — file upload with a mock analysis display
- **Job Description Page** — textarea input with a mock analysis display
- **Interview Setup** — select role, type, difficulty, and duration
- **Mock Interview** — question-by-question interface with progress tracking, timer, and state management
- **Interview Result** — mock evaluation report with scores, strengths, and improvement areas
- **Interview History** — list of previous mock attempts
- **Profile Page** — view and edit candidate details
- **FastAPI Backend** — health check, auth, resume, job description, and interview endpoints with mock services
- **AI Service Abstraction** — mock implementation ready to be replaced with a real AI provider

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
- pytest

### Database (Planned)

- PostgreSQL — not connected yet; current data is in-memory/mock

### AI (Planned)

- Google Gemini API
- Sentence Transformers
- RAG / vector search where required

## Project Structure

```text
AI-Mock-Interview-Platform/
├── .gitignore
├── README.md
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── api/routes/       # FastAPI routers
│   │   ├── core/             # configuration
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # business logic
│   │   ├── repositories/     # data-access layer
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
        ├── types/
        ├── utils/mockData.ts
        ├── services/           # API service layer
        ├── components/         # reusable UI components
        ├── layouts/            # dashboard and auth layouts
        ├── pages/              # route pages
        └── routes/
```

## Running Locally

### 1. Clone the repository

```bash
cd "C:\Users\Swapnil\OneDrive\Desktop\Study\PBL LY Sem-1\AI-Mock-Interview-Platform"
```

### 2. Backend setup

Create and activate a Python virtual environment, then install the dependencies from `requirements.txt`.

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # On Windows
pip install -r requirements.txt
```

Copy the example environment file and adjust values if needed:

```bash
cp .env.example .env      # On Windows: copy .env.example .env
```

Start the backend:

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

Example health check:

```bash
curl http://localhost:8000/api/v1/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "IntelliInterview API"
}
```

Run the minimal backend test:

```bash
pytest
```

### 3. Frontend setup

In a separate terminal, install dependencies and run the Vite dev server.

```bash
cd ../frontend
copy .env.example .env
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173` by default.

### 4. Basic user flow

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

## Current Status

This is an initial skeleton. All data is currently mock/in-memory and the AI logic is simulated through `AIService` and `EvaluationService`. No real database, authentication provider, or external AI API is integrated yet.

## Future Scope

- PostgreSQL persistence
- Real JWT authentication
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
