# AGENTS.md — IntelliInterview

## Reference repository

The folder `ireqruit-premium-backend/` inside this repository is a **read-only architectural reference** for IntelliInterview.

- It must never be modified.
- It must never be imported or executed.
- It is not part of the IntelliInterview application.
- It must not be included in builds, tests, or deployments.
- IntelliInterview remains an independent implementation.

Future IntelliInterview backend code should follow the reference repository's architecture, organization, naming conventions, database patterns, service/query separation, configuration patterns, exception handling, logging patterns, and utility organization **unless a future prompt explicitly overrides this rule**.

## Database architecture (FROZEN)

The final IntelliInterview database stack is fixed as:

- **ORM / model layer:** SQLModel
- **PostgreSQL driver:** asyncpg
- **Database:** PostgreSQL
- **Migrations:** Alembic

All database schema changes must be performed through Alembic migrations. Never use `Base.metadata.create_all()` or `SQLModel.metadata.create_all()` inside application startup. Never create or alter tables manually.

## Migration workflow

```
Modify SQLModel model
   |
   v
alembic revision --autogenerate -m "describe change"
   |
   v
Review generated migration
   |
   v
alembic upgrade head
```
