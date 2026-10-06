# ESP32 integration (next step)

Physical hardware is intentionally not connected in this software milestone. The backend is prepared to receive one validated JSON telemetry object per HTTP POST at `http://<backend-host>:8000/api/telemetry`.

```json
{
  "device_id": "EVG-001",
  "timestamp": "2026-10-06T10:00:00Z",
  "voltage": 3.91,
  "current": 4.2,
  "soc": 76.0,
  "temperatures": {
    "cell_1": 36.2,
    "cell_2": 36.8,
    "cell_3": 37.1,
    "cell_4": 38.4
  }
}
```

`power` is optional and computed from voltage times current when omitted. `soh` is optional because no validated SOH estimator is implemented. The development mock is enabled by default; disable it with `MOCK_TELEMETRY_ENABLED=false` before connecting an ESP32. A fresh hardware sample already suppresses mock writes for the same device. Keep the physical BMS protections authoritative; the software model and demo fan output are advisory only.

The example CORS list permits only localhost development origins. If the ESP32 communicates directly from a browser origin (normally it should communicate with the API over HTTP itself), configure only the exact required frontend origin in `CORS_ORIGINS`.
