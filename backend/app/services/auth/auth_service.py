from datetime import datetime, timezone

from fastapi import status
from sqlalchemy.exc import IntegrityError
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.exception import CustomException
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, UserUpdate
from app.services.auth.auth_query import RevokedTokenQuery, UserQuery

DUPLICATE_EMAIL_MESSAGE = "An account with this email already exists."
ACCOUNT_NOT_FOUND_MESSAGE = (
    "No account exists with this email address. Please sign up first."
)


class Auth:
    def __init__(self, db: AsyncSession):
        self._db = db
        self._query = UserQuery(db)
        self._tokens = RevokedTokenQuery(db)

    async def register(self, user: UserCreate) -> UserResponse:
        if await self._query.get_by_email(user.email):
            raise CustomException(
                status.HTTP_400_BAD_REQUEST, DUPLICATE_EMAIL_MESSAGE
            )
        hashed = get_password_hash(user.password)
        try:
            db_user = await self._query.create(user, hashed)
        except IntegrityError:
            # A concurrent registration won the race on the unique index.
            await self._db.rollback()
            raise CustomException(
                status.HTTP_400_BAD_REQUEST, DUPLICATE_EMAIL_MESSAGE
            )
        return UserResponse.model_validate(db_user)

    async def login(self, credentials: UserLogin) -> tuple[User, str]:
        user = await self._query.get_by_email(credentials.email)
        if not user:
            raise CustomException(
                status.HTTP_404_NOT_FOUND, ACCOUNT_NOT_FOUND_MESSAGE
            )
        if not verify_password(credentials.password, user.hashed_password):
            raise CustomException(
                status.HTTP_401_UNAUTHORIZED, "Invalid credentials"
            )
        token = create_access_token({"sub": str(user.id)})
        return user, token

    async def get_current_user(self, user) -> UserResponse:
        return UserResponse.model_validate(user)

    async def update_user(self, user, update: UserUpdate) -> UserResponse:
        updated = await self._query.update(user, update)
        return UserResponse.model_validate(updated)

    async def logout(self, user, payload: dict) -> None:
        """Revoke the presented access token by denylisting its jti claim
        until the token's own expiry."""
        jti = payload.get("jti")
        exp = payload.get("exp")
        if not jti or not exp:
            return
        await self._tokens.revoke(
            user.id, jti, datetime.fromtimestamp(exp, tz=timezone.utc)
        )
