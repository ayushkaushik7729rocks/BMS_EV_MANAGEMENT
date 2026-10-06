from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.database.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TelemetryRow(Base):
    __tablename__ = "telemetry"
    __table_args__ = (Index("ix_telemetry_device_time", "device_id", "timestamp"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[str] = mapped_column(String(80), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    voltage: Mapped[float] = mapped_column(Float)
    current: Mapped[float] = mapped_column(Float)
    power: Mapped[float] = mapped_column(Float)
    soc: Mapped[float] = mapped_column(Float)
    soh: Mapped[float | None] = mapped_column(Float, nullable=True)
    cell_1_temperature: Mapped[float] = mapped_column(Float)
    cell_2_temperature: Mapped[float] = mapped_column(Float)
    cell_3_temperature: Mapped[float] = mapped_column(Float)
    cell_4_temperature: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(16), default="hardware", index=True)
    scenario: Mapped[str | None] = mapped_column(String(32), nullable=True)


class AlertRow(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[str] = mapped_column(String(80), index=True)
    code: Mapped[str] = mapped_column(String(64), index=True)
    severity: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(160))
    detail: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
