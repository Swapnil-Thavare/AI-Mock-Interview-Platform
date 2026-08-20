from typing import List, Optional
import uuid

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


class UserRepository:
    def __init__(self, db: Session):
        self._db = db

    def get_by_email(self, email: str) -> Optional[User]:
        return self._db.query(User).filter(User.email == email).first()

    def get_by_id(self, user_id) -> Optional[User]:
        if isinstance(user_id, str):
            user_id = uuid.UUID(user_id)
        return self._db.get(User, user_id)

    def get_all(self) -> List[User]:
        return self._db.query(User).all()

    def create(self, obj: UserCreate, hashed_password: str) -> User:
        user = User(
            email=obj.email,
            full_name=obj.full_name,
            hashed_password=hashed_password,
        )
        self._db.add(user)
        self._db.commit()
        self._db.refresh(user)
        return user

    def update(self, user: User, update: UserUpdate) -> User:
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
        self._db.commit()
        self._db.refresh(user)
        return user
