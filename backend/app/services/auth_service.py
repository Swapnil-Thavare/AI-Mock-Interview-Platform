from app.repositories import AuthRepository
from app.schemas import User, UserLogin


class AuthService:
    def __init__(self):
        self._repo = AuthRepository()

    def register(self, user: User) -> dict:
        self._repo.create(user)
        return {"message": "User registered successfully", "user_id": user.id}

    def login(self, credentials: UserLogin) -> dict:
        return {
            "message": "Login successful",
            "access_token": "mock-jwt-token",
            "token_type": "bearer",
        }
