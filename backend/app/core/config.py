from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "IntelliInterview API"
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    SECRET_KEY: str = "change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
