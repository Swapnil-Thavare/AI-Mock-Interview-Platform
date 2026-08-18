from typing import Optional

from pydantic import BaseModel


class User(BaseModel):
    id: Optional[int] = None
    email: str
    full_name: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str
