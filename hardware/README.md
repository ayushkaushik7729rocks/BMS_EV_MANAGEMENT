# ESP32 hardware integration

The firmware in [`esp32_ev_guardian.ino`](esp32_ev_guardian.ino) matches the FastAPI telemetry contract used by the existing dashboard. It posts one hardware record every five seconds to `POST /api/telemetry`; the backend persists it and the frontend reads the resulting `/api/battery/status` response.

## Start here

Follow [`ESP32_SETUP.md`](ESP32_SETUP.md) for the pin map, wiring, libraries, backend configuration, upload steps, and safe bring-up. The sketch assumes a protected **1S4P** 18650 demonstration pack and a LAN-reachable backend.

## Important interface boundaries

- Four DS18B20 temperature values are required by the backend; the sketch skips a POST if any sensor is missing or invalid.
- The INA219 provides **pack-level** voltage and current. It does not measure individual cell voltages.
- SOC is approximate coulomb counting with an editable starting SOC and nominal pack capacity.
- This backend receives telemetry over HTTP. It does not receive MQTT from this sketch.
- The backend's thermal prediction is advisory. This firmware does not claim validated SOH, RUL, or failure-probability estimates.
- The fan, buzzer, and auxiliary relay are demonstration outputs. The relay is not wired as a battery contactor. Keep certified pack protection independent and authoritative.
