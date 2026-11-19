import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import func
from sqlmodel import delete, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.revoked_token import RevokedToken
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


class UserQuery:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self._db.exec(
            select(User).where(func.lower(User.email) == email.lower())
        )
        return result.first()

    async def get_by_id(self, user_id) -> Optional[User]:
        if isinstance(user_id, str):
            user_id = uuid.UUID(user_id)
        return await self._db.get(User, user_id)

    async def get_all(self) -> List[User]:
        result = await self._db.exec(select(User))
        return result.all()

    async def create(self, obj: UserCreate, hashed_password: str) -> User:
        user = User(
            email=obj.email,
            full_name=obj.full_name,
            hashed_password=hashed_password,
        )
        self._db.add(user)
        await self._db.commit()
        await self._db.refresh(user)
        return user

    async def update(self, user: User, update: UserUpdate) -> User:
        if update.full_name is not None:
            user.full_name = update.full_name
        if update.phone is not None:
            user.phone = update.phone
        if update.skills is not None:
            user.skills = update.skills
        if update.education is not None:
            user.education = update.education
        if update.experience is not None:
            user.experience = update.experience
        self._db.add(user)
        await self._db.commit()
        await self._db.refresh(user)
        return user


class RevokedTokenQuery:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def is_revoked(self, jti: str) -> bool:
        result = await self._db.exec(
            select(RevokedToken.id).where(RevokedToken.jti == jti)
        )
        return result.first() is not None

    async def revoke(
        self, user_id: uuid.UUID, jti: str, expires_at: datetime
    ) -> None:
        if await self.is_revoked(jti):
            return
        self._db.add(
            RevokedToken(user_id=user_id, jti=jti, expires_at=expires_at)
        )
        # Rows past the token's own expiry can never authenticate again —
        # prune them so the denylist stays bounded to live tokens.
        await self._db.exec(
            delete(RevokedToken).where(
                RevokedToken.expires_at < datetime.now(timezone.utc)
            )
        )
        await self._db.commit()
