from typing import Dict, Optional

from app.schemas import User


class AuthRepository:
    def __init__(self):
        self._users: Dict[int, User] = {}
        self._next_id = 1

    def create(self, user: User) -> User:
        user.id = self._next_id
        self._users[user.id] = user
        self._next_id += 1
        return user

    def get_by_email(self, email: str) -> Optional[User]:
        for user in self._users.values():
            if user.email == email:
                return user
        return None
