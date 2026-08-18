from fastapi import APIRouter

from app.schemas import User, UserLogin
from app.services import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
service = AuthService()


@router.post("/register")
def register(user: User):
    return service.register(user)


@router.post("/login")
def login(credentials: UserLogin):
    return service.login(credentials)
