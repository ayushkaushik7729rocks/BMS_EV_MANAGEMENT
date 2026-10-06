import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import alerts, battery, demo, prediction, telemetry
from app.core.config import Settings, get_settings
from app.database.database import create_tables
from app.services.mock_telemetry_service import get_mock_generator, run_mock_telemetry


def create_app(settings: Settings | None = None, initialize_database: bool = True) -> FastAPI:
    config = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if initialize_database:
            create_tables()
        task = None
        if config.mock_telemetry_enabled:
            generator = get_mock_generator(config)
            task = asyncio.create_task(run_mock_telemetry(generator), name="mock-telemetry")
            app.state.mock_generator = generator
        try:
            yield
        finally:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    application = FastAPI(title=config.app_name, version="0.1.0", lifespan=lifespan)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )
    application.include_router(telemetry.router)
    application.include_router(battery.router)
    application.include_router(prediction.router)
    application.include_router(alerts.router)
    application.include_router(demo.router)

    @application.get("/api/health", tags=["health"])
    def health():
        return {"status": "ok", "service": config.app_name, "mock_telemetry_enabled": config.mock_telemetry_enabled}

    @application.get("/", include_in_schema=False)
    def root():
        return {"service": config.app_name, "docs": "/docs", "health": "/api/health"}

    return application


app = create_app()
