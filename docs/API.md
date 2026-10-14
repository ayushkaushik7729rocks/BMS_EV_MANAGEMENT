# API reference

Default local base URL: `http://127.0.0.1:8000`. Production HTTPS requires the separately configured reverse proxy described in `../hardware/README.md`; the FastAPI app does not terminate TLS itself.

Interactive docs are available at `/docs` while the server is running.

## Telemetry contract

`POST /api/telemetry` accepts one `TelemetryPayload`; Pydantic validates and persists it. The route requires `Authorization: Bearer <EV_GUARDIAN_DEVICE_TOKEN>` by default. Missing and invalid credentials return 401. Health remains public.

```json
{
  "device_id": "EVG-001",
  "timestamp": "2026-10-06T10:00:00Z",
  "voltage": 3.91,
  "current": 4.2,
  "power": 16.42,
  "soc": 76.0,
  "soh": 96.4,
  "temperatures": {"cell_1": 36.2, "cell_2": 36.8, "cell_3": 37.1, "cell_4": 38.4}
}
```

`power` and `soh` are optional. Power is calculated as voltage times current if omitted. SOH is optional because the ESP32 cannot provide a validated SOH estimate unless a separate estimator is implemented. The four cell temperatures are required. `source` defaults to `hardware`; backend demo samples use `mock`, and sensor-free connectivity samples must explicitly use `test`. Source labels are descriptive rather than cryptographic attestation. The current default configuration disables the mock generator.

## Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Backend health and mock-mode status |
| POST | `/api/telemetry` | Validate and persist hardware or mock telemetry |
| GET | `/api/telemetry/latest` | Latest raw validated record; optional `device_id` |
| GET | `/api/telemetry/history` | Ordered records; supports `device_id`, `limit` (1-5000), and `since` |
| GET | `/api/battery/status` | Unified current status, risk, prediction, ETA, history, and alerts |
| GET | `/api/prediction/latest` | Latest prediction and risk calculation |
| GET | `/api/alerts` | Recent stored alerts; optional `limit` |
| POST | `/api/alerts/{id}/acknowledge` | Acknowledge one alert |
| GET | `/api/demo/scenario` | Current development scenario |
| POST | `/api/demo/scenario` | Select a mock scenario with `{"scenario":"HIGH_LOAD"}` |

The demo scenario routes return HTTP 409 when mock telemetry is disabled.

## Battery status response

`GET /api/battery/status` extends the validated telemetry record with four-channel average/maximum temperature, thermal prediction, risk and ETA, up to 120 recent history points, current alerts, device freshness, and a demo fan output. Current risk and ETA use the hottest measured sensor; the ML estimate is the four-sensor average and is advisory. `COOLING_ACTIVATION_C` configures the demo fan indicator independently from the battery safety threshold. Prediction source is one of the trained model names, `trend_baseline`, or `unavailable`.

## CORS, authentication, and frontend

Serve `frontend2/` at `http://localhost:5500` or `http://127.0.0.1:5500`. Those origins are the development defaults. Direct `file://` opening does not work for cross-origin API fetches. Configure additional exact origins through `CORS_ORIGINS`; avoid wildcard origins in deployment. For LAN dashboards, use the backend host's LAN address as `window.EV_GUARDIAN_API_BASE` (or update the existing `API_BASE` default), and add the exact frontend origin. Browsers block HTTPS pages that fetch an HTTP API as mixed content. Configure HTTPS for both through the Caddy deployment before remote/LAN production use.

Generate a strong token with `python -c "import secrets; print(secrets.token_urlsafe(32))"` and set it as `EV_GUARDIAN_DEVICE_TOKEN` in the private backend environment. With `DEVICE_AUTH_ENABLED=true`, the backend refuses startup if the token is missing or shorter than 32 characters. Disabling device auth is only suitable for isolated loopback development; it must not be used on a network interface.
