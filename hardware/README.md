# ESP32 integration

The existing backend accepts telemetry at `POST /api/telemetry`. Physical sensors are not required for the sensor-free smoke test below. The test sketch sends fixed values with `source: "test"`; it does not read or claim to represent hardware measurements.

## Arduino libraries and local files

Use the Espressif Arduino ESP32 core (WiFi support) and the core libraries `HTTPClient` and `WiFiClientSecure` (included with the ESP32 core). Open `esp32_smoke_test/esp32_smoke_test.ino` in Arduino IDE, select the actual ESP32 board and port, and install the matching Espressif board package if needed.

In that sketch folder, copy `secrets.example.h` to `secrets.h` and replace the Wi-Fi name/password, API bearer token, and real HTTPS endpoint. Copy `server_root_ca.example.h` to `server_root_ca.h` and replace its placeholder with the complete PEM root CA certificate that issued the server certificate. Obtain the CA certificate from its official source. These local files are ignored by Git. The sketch verifies TLS using `setCACert`; it does not disable certificate validation. Never print the token or commit either local file.

## HTTPS deployment prerequisite

The repository includes `../deploy/Caddyfile.example` as a reverse-proxy template. It does not activate HTTPS by itself. For production, first:

1. Obtain a public hostname and point its DNS A/AAAA records to the server.
2. Install Caddy on that server, set `EV_GUARDIAN_DOMAIN` to the hostname, and use the template as its Caddyfile. Caddy can obtain/renew a publicly trusted certificate when DNS resolves correctly and inbound TCP ports 80 and 443 reach Caddy.
3. Run Uvicorn on `127.0.0.1:8000` without `--reload`; for example, from `backend/`: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --proxy-headers --forwarded-allow-ips=127.0.0.1`. Keep port 8000 private and expose only Caddy's 80/443 ports through the firewall.
4. Configure `EV_GUARDIAN_DEVICE_TOKEN` on the backend and provision the matching token to the ESP32 locally. Configure the trusted root CA in `server_root_ca.h`.
5. From an external client, verify the certificate and `https://<hostname>/api/health` before loading the endpoint into firmware.

No hostname, DNS record, certificate, or proxy is configured by this repository. Until those manual deployment steps are complete and externally verified, HTTPS is not operational. Never substitute a self-signed certificate or an unverified TLS connection for production.

## Exact API request contract

These required fields match `backend/app/schemas/telemetry.py`. `timestamp` may be omitted (the backend supplies one); `power` may be omitted (computed as voltage × current); `soh` is optional. All four temperature fields and SOC are required. `source` defaults to `hardware`; sensor-free samples must explicitly set `test`.

```json
{
  "device_id": "EVG-001",
  "timestamp": "2026-10-14T10:00:00Z",
  "voltage": 3.91,
  "current": 4.2,
  "soc": 76.0,
  "temperatures": {
    "cell_1": 36.2,
    "cell_2": 36.8,
    "cell_3": 37.1,
    "cell_4": 38.4
  },
  "source": "hardware"
}
```

Send to `https://<hostname>/api/telemetry` with `Content-Type: application/json` and `Authorization: Bearer <EV_GUARDIAN_DEVICE_TOKEN>`. A successful request returns **201** and the stored telemetry record. **401** means missing/invalid credentials; **422** means the JSON does not satisfy the schema. Retry network failures and 5xx responses with bounded exponential backoff (the example sketch starts at 2 seconds and caps at 5 minutes). Do not retry 401/422 without correcting configuration/data. Log status codes and device identifiers only; never log the bearer token.

## Sensor-free ESP32 smoke test

The sketch in `esp32_smoke_test/` uses fixed sample values for connectivity/validation only and labels every POST `source: "test"`. Compile and upload only after configuring the local ignored headers and deploying the HTTPS endpoint. It verifies Wi-Fi, trusted HTTPS certificate validation, bearer authentication, JSON validation, HTTP status handling, and bounded retry. A successful 201 confirms ingestion; it is not a sensor measurement. Mock telemetry may remain disabled during this test.

For the API/database check before uploading firmware, start the local backend on `127.0.0.1`, then from PowerShell in the repository root run:

```powershell
$token = (Get-Content backend/.env | Where-Object { $_ -match '^EV_GUARDIAN_DEVICE_TOKEN=' } | Select-Object -Last 1) -replace '^EV_GUARDIAN_DEVICE_TOKEN=', ''
$payload = @{ device_id = 'EVG-LOCAL-SMOKE-TEST'; voltage = 3.91; current = 0.25; soc = 50.0; temperatures = @{ cell_1 = 25.0; cell_2 = 25.0; cell_3 = 25.0; cell_4 = 25.0 }; source = 'test' } | ConvertTo-Json -Depth 4
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/telemetry' -Method Post -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" } -Body $payload
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/telemetry/latest?device_id=EVG-LOCAL-SMOKE-TEST'
Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/battery/status'
```

The authenticated POST should return the stored row (201); latest/status retrieval should show `source: test`. To test validation, omit `soc` or a cell temperature and expect 422. The dashboard at the local static-server URL should show **Simulated test telemetry**. The local HTTP test runs only against loopback; do not send the bearer token over untrusted LAN HTTP.

Verify a received sample through `GET https://<hostname>/api/telemetry/latest?device_id=EVG-ESP32-SMOKE-TEST` and `GET https://<hostname>/api/battery/status`. For a local SQLite check, run from `backend/`:

```powershell
.\.venv\Scripts\python.exe -c "import sqlite3; db=sqlite3.connect('data/bms.sqlite3'); print(db.execute('select id, device_id, source, timestamp from telemetry order by id desc limit 10').fetchall())"
```

Confirm the sample's `source` is `test`. The dashboard labels test samples as simulated. Once physical sensors are installed, change the firmware to acquire actual readings and send `source: "hardware"`; do not reuse the fixed test values.

## Real sensors are a separate milestone

The current contract needs SOC and four cell temperatures. An INA219 alone does not produce a validated SOC estimate, and one DS18B20 does not provide four independent cell temperatures. Confirm the real sensor count, placement, pack voltage/current measurement range, SOC method, calibration, and safety limits before implementing the hardware payload. Keep the physical BMS protections authoritative; the backend prediction and fan status are advisory only.
