from fastapi import status
from sqlalchemy.orm import Session

from app.core.security import create_access_token, get_password_hash, verify_password
from app.exception import CustomException
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse, UserUpdate
from app.services.auth.auth_query import UserQuery


class Auth:
    def __init__(self, db: Session):
        self._query = UserQuery(db)

    def register(self, user: UserCreate) -> UserResponse:
        if self._query.get_by_email(user.email):
            raise CustomException(status.HTTP_400_BAD_REQUEST, "Email already registered")
        hashed = get_password_hash(user.password)
        db_user = self._query.create(user, hashed)
        return UserResponse.model_validate(db_user)

    def login(self, credentials: UserLogin) -> Token:
        user = self._query.get_by_email(credentials.email)
        if not user or not verify_password(credentials.password, user.hashed_password):
            raise CustomException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
        token = create_access_token({"sub": str(user.id)})
        return Token(access_token=token)

    def get_current_user(self, user) -> UserResponse:
        return UserResponse.model_validate(user)

    def update_user(self, user, update: UserUpdate) -> UserResponse:
        updated = self._query.update(user, update)
        return UserResponse.model_validate(updated)
