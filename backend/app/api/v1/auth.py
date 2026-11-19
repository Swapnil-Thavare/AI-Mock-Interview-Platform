from typing import Optional

from fastapi import APIRouter, Depends, Response
from sqlmodel.ext.asyncio.session import AsyncSession

from app.core.config import settings
from app.core.security import (
    ACCESS_TOKEN_COOKIE,
    decode_access_token,
    get_access_token,
    get_current_user,
)
from app.db.db import get_session
from app.models.user import User
from app.schemas import UserCreate, UserLogin, UserResponse, UserUpdate
from app.services.auth.auth_service import Auth

router = APIRouter()


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite=settings.AUTH_COOKIE_SAMESITE,
        path="/",
    )


@router.post("/register", response_model=UserResponse)
async def register(
    user: UserCreate, db: AsyncSession = Depends(get_session)
):
    return await Auth(db).register(user)


@router.post("/login", response_model=UserResponse)
async def login(
    credentials: UserLogin,
    response: Response,
    db: AsyncSession = Depends(get_session),
):
    # The access token is delivered only as an HttpOnly cookie — it is
    # never exposed in the response body where client-side JS could read it.
    user, token = await Auth(db).login(credentials)
    _set_session_cookie(response, token)
    return UserResponse.model_validate(user)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout(
    response: Response,
    token: Optional[str] = Depends(get_access_token),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    # get_current_user already rejected a missing/invalid token, so the
    # presented token is valid here; revoke it by its jti claim.
    if token:
        await Auth(db).logout(current_user, decode_access_token(token))
    response.delete_cookie(ACCESS_TOKEN_COOKIE, path="/")
    return {"detail": "Logged out"}


@router.patch("/me", response_model=UserResponse)
async def update_me(
    update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    return await Auth(db).update_user(current_user, update)
