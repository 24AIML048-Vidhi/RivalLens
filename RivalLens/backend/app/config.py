"""
Central place for all environment-driven config. Everything else in the app
imports `settings` from here instead of calling os.getenv() directly.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "sqlite:///./rivallens.db"

    # Instagram API (Meta Graph API)
    instagram_access_token: str = ""
    instagram_app_id: str = ""
    instagram_app_secret: str = ""
    instagram_account_id: str = ""

    # YouTube Data API v3
    youtube_api_key: str = ""

    # Reddit API (PRAW)
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    reddit_user_agent: str = "RivalLens/1.0"

    # App
    environment: str = "development"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000"

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        # In development mode, allow standard dev ports
        return origins


settings = Settings()