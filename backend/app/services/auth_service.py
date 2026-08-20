from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse, UserUpdate


class AuthService:
    def __init__(self, db: Session):
        self._repo = UserRepository(db)

    def register(self, user: UserCreate) -> UserResponse:
        if self._repo.get_by_email(user.email):
            raise HTTPException(status_code=400, detail="Email already registered")
        hashed = get_password_hash(user.password)
        db_user = self._repo.create(user, hashed)
        return UserResponse.model_validate(db_user)

    def login(self, credentials: UserLogin) -> Token:
        user = self._repo.get_by_email(credentials.email)
        if not user or not verify_password(credentials.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        token = create_access_token({"sub": str(user.id)})
        return Token(access_token=token)

    def get_current_user(self, user) -> UserResponse:
        return UserResponse.model_validate(user)

    def update_user(self, user: User, update: UserUpdate) -> UserResponse:
        updated = self._repo.update(user, update)
        return UserResponse.model_validate(updated)
