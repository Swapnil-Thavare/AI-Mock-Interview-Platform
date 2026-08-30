import uuid
from typing import List, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


class UserQuery:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self._db.exec(select(User).where(User.email == email))
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
