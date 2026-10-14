import hmac

from fastapi import HTTPException, Request


def require_device_token(request: Request) -> None:
    settings = request.app.state.settings
    if not settings.device_auth_enabled:
        return

    configured = settings.device_token.get_secret_value() if settings.device_token else ""
    if len(configured) < 32:
        # Startup validation should prevent this configuration from serving requests.
        raise HTTPException(status_code=503, detail="Device authentication is not configured")

    authorization = request.headers.get("authorization", "")
    scheme, separator, supplied = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not supplied:
        raise HTTPException(
            status_code=401,
            detail="A valid bearer token is required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not hmac.compare_digest(supplied.encode("utf-8"), configured.encode("utf-8")):
        raise HTTPException(
            status_code=401,
            detail="A valid bearer token is required",
            headers={"WWW-Authenticate": "Bearer"},
        )
