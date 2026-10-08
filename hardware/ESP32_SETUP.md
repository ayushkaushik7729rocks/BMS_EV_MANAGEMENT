# TARANG / EV Guardian AI — ESP32 setup and backend integration

This guide connects the ESP32 to the existing FastAPI backend and dashboard in this repository. The firmware sends measured values; the Python service stores them, creates thermal forecasts/alerts, and supplies the UI. **Prediction is performed by the backend, not fabricated on the ESP32.**

## 1. Hardware assumptions and limits

The sketch assumes four matched 18650 cells in a **protected 1S4P** demonstration pack. It measures total pack voltage/current through an INA219 and reads four cell-surface temperature channels. It does not measure each cell's voltage, balance cells, calculate a validated SOH/RUL, or replace a BMS.

The INA219 firmware calibration is configured for 32 V / 2 A. Keep the demonstration current within the breakout board's shunt rating and the selected 2 A calibration. The INA219 IC bus input is limited to 26 V; this sketch is not intended for an EV traction pack.

## 2. Pin map

| ESP32 pin | Connection | Notes |
|---|---|---|
| GPIO 21 | SDA: INA219 + OLED | Shared I2C bus |
| GPIO 22 | SCL: INA219 + OLED | Shared I2C bus |
| GPIO 4 | DS18B20 data bus | Four sensors share one bus; 4.7 kΩ pull-up to 3.3 V |
| GPIO 25 | Fan MOSFET gate input | Through 100–220 Ω; 10 kΩ gate pull-down to GND |
| GPIO 26 | Auxiliary relay module IN | Relay contacts switch a separate low-voltage demo indicator only |
| GPIO 27 | Buzzer transistor input | Do not power a buzzer directly from the GPIO |
| 3V3 | DS18B20 VDD, INA219 VCC, OLED VCC | Confirm OLED module accepts 3.3 V |
| GND | Sensor grounds and signal reference | Common signal ground with the low-voltage load supply |

### Sensor wiring

**Four DS18B20 probes:** connect all VDD wires to 3.3 V, all GND wires to GND, and all DATA wires to GPIO 4. Fit one 4.7 kΩ resistor between GPIO 4 / DATA and 3.3 V. Use three-wire powered mode, not parasite power. The sketch enumerates the ROM addresses and reports the mapping in Serial Monitor; mark the probes as `cell_1` to `cell_4` in that reported order. Sensor order can change if the probes are replaced or rewired.

**INA219:** VCC to 3.3 V, GND to common GND, SDA to GPIO 21, SCL to GPIO 22. Insert the shunt in the positive path: protected pack output `+` → fuse → INA219 `VIN+`; INA219 `VIN−` → positive terminal of the low-current test load. Pack negative goes to the load negative. With this orientation, positive current means discharge and SOC decreases. Check the board labels because clone boards can vary.

The INA219 already measures bus voltage and current. **Do not add a voltage divider to the same measurement.** For this project configuration the reported voltage is pack-level voltage (about one cell's voltage for a 1S4P pack).

**OLED:** connect VCC to 3.3 V, GND to GND, SDA to GPIO 21, and SCL to GPIO 22. The sketch expects address `0x3C`; adjust `OLED_ADDRESS` if the module uses a different address.

### Demonstration outputs

- **Fan:** use a separate rated 5 V or 12 V fan supply. Connect fan positive to its supply; fan negative to the drain of a logic-level N-channel MOSFET; MOSFET source to supply/ESP32 common GND; GPIO 25 to gate through 100–220 Ω. Add a 10 kΩ gate-to-GND pull-down. Add a flyback diode only for a brushed inductive DC fan, oriented cathode to fan positive and anode to the MOSFET drain; follow the fan manufacturer's suppression guidance for BLDC fans. The sketch drives the fan as a binary demonstration output.
- **Relay:** connect a 3.3 V-compatible relay module input to GPIO 26, its logic supply as specified by the module, and logic GND to common GND. The contacts should switch only a separate low-voltage demo lamp/indicator. The relay is not a traction battery contactor and must not disconnect the cell pack.
- **Buzzer:** use an NPN transistor driver (GPIO 27 through about 1 kΩ to base, emitter to GND, collector to buzzer negative, buzzer positive to its rated supply). Add a diode if the buzzer is an inductive type.
- Do not power the fan or relay coil from the ESP32 3.3 V pin. Use a separate regulated supply sized for the loads and connect signal grounds.

## 3. Battery and bench safety

Use a commercially protected 1S4P pack or a properly designed holder/pack with a 1S BMS, correctly rated fuse, and cell-level fusible links. Cells must be the same chemistry, model, age, and capacity, and be at closely matched voltages before parallel connection. Do not solder directly to bare cells. Use a proper 1S Li-ion charger; do not charge through the ESP32, INA219, relay, or demonstration wiring. Do not leave the pack unattended.

Never intentionally overcharge, short, puncture, or heat an 18650 cell. For a heating demonstration, put a ceramic resistor on a separate insulated fixture near the DS18B20 probe; do not attach a heating element to the cell. Use a current-limited low-voltage supply and an adult-supervised bench setup. Stop immediately if a cell swells, vents, smells unusual, or heats unexpectedly. Keep the pack's independent BMS protection in circuit at all times.

The example `COOLING_START_C` and `DEMO_ALERT_C` are showcase settings only, not safety limits. Choose settings from the cell datasheet and institutional lab procedure. The backend's example `THERMAL_THRESHOLD_C=55.0` is explicitly a software demo default; it is not a cell safety recommendation.

## 4. Arduino IDE setup

1. Install the ESP32 board package and select **ESP32 Dev Module** (or the exact ESP32 board variant).
2. In Library Manager install: **OneWire**, **DallasTemperature**, **Adafruit INA219**, **Adafruit SSD1306**, and **Adafruit GFX Library**. WiFi, Wire, HTTPClient, and time are provided by the ESP32 Arduino core.
3. Open `hardware/esp32_ev_guardian.ino`.
4. Set `WIFI_SSID`, `WIFI_PASSWORD`, `API_URL`, and `DEVICE_ID` near the top. Set `API_URL` to the computer's LAN address, e.g. `http://192.168.1.25:8000/api/telemetry`; `127.0.0.1` means the ESP32 itself and will not reach the computer.
5. Set `PACK_CAPACITY_AH` to the pack's rated capacity. Set `INITIAL_SOC_PERCENT` to a reasonable known starting estimate. The displayed SOC is approximate coulomb counting and will drift; it is not a calibrated gauge.
6. Check GPIO mapping and relay active level against the actual modules before connecting actuators.
7. Connect the ESP32 to the computer over USB, select its COM port, upload, then open Serial Monitor at **115200 baud**.

## 5. Start the backend and frontend

### Backend terminal (PowerShell)

From the repository root:

```powershell
cd backend
Copy-Item .env.example .env   # only if .env does not already exist
```

Edit `backend/.env` before hardware use:

```dotenv
DEVICE_ID=EVG-001
MOCK_TELEMETRY_ENABLED=false
COOLING_ACTIVATION_C=34.0
```

Set `THERMAL_THRESHOLD_C` only to a value selected from the relevant cell manufacturer's documentation and lab safety review. Do not use the example value as a physical limit. Then start the API so devices on the local network can reach it:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Allow the private-network firewall prompt if it appears. Find the computer's LAN IPv4 address with `ipconfig`, and use that exact address in the sketch's `API_URL`. Keep the laptop and ESP32 on the same trusted Wi-Fi network. Do not expose this development API to the public internet.

### Frontend terminal

From the repository root, serve the existing frontend as before:

```powershell
cd frontend2
python -m http.server 5500
```

Open `http://127.0.0.1:5500` on the same computer. The browser frontend calls the backend on localhost; the ESP32 independently calls the backend using the computer's LAN address.

## 6. Bring-up sequence and expected behavior

1. With the battery disconnected, inspect power polarity, common ground, I2C wiring, and MOSFET/relay wiring. Confirm no actuator load is powered by the ESP32 board.
2. Power the ESP32 by USB. Serial Monitor should report the INA219 and four DS18B20 ROM addresses. If fewer than four probes are found, the sketch will not send incomplete telemetry; it turns the demonstration outputs on and shows a sensor fault.
3. Confirm OLED readings are plausible. Compare pack voltage/current with a trusted multimeter and current-limited bench load before connecting the protected cell pack.
4. Start the backend with mock telemetry disabled, then upload/run the ESP32 sketch. Serial Monitor should report `POST /api/telemetry -> 201` (or another 2xx response).
5. Open `http://<computer-LAN-IP>:8000/docs` on the computer or request `GET /api/telemetry/latest?device_id=EVG-001`. Confirm `source` is `hardware`, `device_id` is correct, and all four temperature channels are present.
6. Refresh the dashboard. Its device status should change to connected as hardware samples arrive every five seconds. The dashboard thermal forecast and alerts come from the backend's configured model or trend baseline.
7. Warm a probe externally and gently using the safe resistor fixture; confirm the local fan output and dashboard telemetry respond. Never heat the cell itself.

## 7. Exact JSON interface

The firmware sends the backend's existing `TelemetryPayload` shape:

```json
{
  "device_id": "EVG-001",
  "timestamp": "2026-10-07T12:00:00Z",
  "voltage": 3.91,
  "current": 0.42,
  "power": 1.642,
  "soc": 79.99,
  "temperatures": {
    "cell_1": 25.1,
    "cell_2": 25.3,
    "cell_3": 25.2,
    "cell_4": 25.4
  },
  "source": "hardware"
}
```

`timestamp` is omitted until ESP32 NTP time is available; the backend timestamps such records on receipt. The backend computes model output from its stored history. SOH/RUL are intentionally omitted because this repository does not yet expose a validated hardware SOH/RUL estimator.

## 8. Troubleshooting

| Symptom | Check |
|---|---|
| HTTP `-1` / connection refused | Correct LAN IP, same Wi-Fi, API started with `--host 0.0.0.0`, port 8000 allowed by private firewall |
| HTTP `422` | Inspect Serial Monitor JSON and `/docs`; verify four finite temperatures, positive voltage, SOC 0–100, and exact `device_id` |
| HTTP `201` but dashboard remains stale | Check `GET /api/battery/status`, device ID, current PC clock, and that hardware `source` is being written |
| INA219 missing | Check I2C SDA/SCL, 3.3 V/GND, address `0x40`, and board orientation |
| Wrong current sign | Check current path: pack positive to `VIN+`, load positive from `VIN−`; charging should read negative with this convention |
| Wrong temperature labels | Read the ROM mapping in Serial Monitor and label probes in enumeration order; re-check after replacing sensors |
| Repeated 85 °C or -127 °C | Check DS18B20 VDD mode, 4.7 kΩ pull-up, shared ground, connector polarity, and probe attachment |
| Wi-Fi works but mock values still appear | Confirm `.env` has `MOCK_TELEMETRY_ENABLED=false`, restart backend, and use the same device ID |

