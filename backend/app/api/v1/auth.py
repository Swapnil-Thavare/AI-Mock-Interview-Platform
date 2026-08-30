from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.security import get_current_user
from app.db.db import get_session
from app.models.user import User
from app.schemas import Token, UserCreate, UserLogin, UserResponse, UserUpdate
from app.services.auth.auth_service import Auth

router = APIRouter()


@router.post("/register", response_model=UserResponse)
async def register(
    user: UserCreate, db: AsyncSession = Depends(get_session)
):
    return await Auth(db).register(user)


@router.post("/login", response_model=Token)
async def login(
    credentials: UserLogin, db: AsyncSession = Depends(get_session)
):
    return await Auth(db).login(credentials)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    return await Auth(db).update_user(current_user, update)
