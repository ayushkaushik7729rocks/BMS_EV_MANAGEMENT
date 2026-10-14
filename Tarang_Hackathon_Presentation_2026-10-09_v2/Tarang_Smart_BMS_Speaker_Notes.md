# Tarang Smart BMS Hackathon Speaker Notes

Total speaking time: 5 minutes. The timings below add to 300 seconds.

## Slide 1 — Introduction (45 seconds)

Battery performance changes with load and temperature, so teams need to see voltage, current and temperature together. Tarang's Smart BMS Monitoring System connects battery measurements to a software view that can show trends and configured abnormal readings.

The software foundation is implemented. The frontend currently receives simulated telemetry from the backend. No physical sensor or embedded controller is connected yet. The image is conceptual artwork, not a photograph of our prototype.

Our value proposition is to connect battery measurements with actionable software insights for more visible and manageable battery operation.

**Likely judge question:** Is this live hardware? No. The displayed values come from the development mock. Physical integration and measurement validation are next.

**Repository sources:** README.md; frontend2/index.html; frontend2/app.js; backend/README.md; hardware/README.md.

## Slide 2 — Technical Explanation (105 seconds)

The software architecture starts with a telemetry schema, not a hardware assumption. The API requires a device identifier, timestamp, voltage, current, SOC and four cell temperatures. Power is calculated when the sender omits it. SOH remains optional because no validated estimator is present.

The intended physical path is a battery pack, measurement channels and ESP32 firmware. The repository does not identify selected sensor part numbers, and this path has not been integrated. The backend provides an HTTP POST endpoint at /api/telemetry. The development mock currently supplies samples.

FastAPI passes incoming payloads through Pydantic validation. SQLAlchemy stores telemetry and alert rows in SQLite by default. The status endpoint combines the latest record with history, four-channel averages and maximums, risk, prediction, alerts, connection freshness and a demo fan indicator. The frontend polls that status endpoint every five seconds.

Risk classification uses the hottest current sensor and recent hottest-sensor trend against a configured threshold. The included default of 55 degrees Celsius came from the earlier UI and is not a validated safe limit. The fan percentage is calculated for display only. There is no relay command, shutdown, or cell-balancing control.

The XGBoost artifact predicts the four-sensor average about ten minutes ahead from CALCE single-cell cycling traces. The held-out CALCE test report records MAE 0.952 degrees Celsius across 8,437 samples. This does not establish performance on a four-cell pack, and the estimate is advisory.

**Likely judge questions:** Accuracy is unknown until calibrated against reference instruments. The REST endpoint is ready, while the ESP32 sender is pending. Hardware protection remains authoritative.

**Repository sources:** docs/ARCHITECTURE.md; docs/API.md; backend/app/schemas/telemetry.py; backend/app/api/telemetry.py; backend/app/services/risk_service.py; backend/app/services/mock_telemetry_service.py; ml/models/metrics.json.

## Slide 3 — Real-Life Application (90 seconds)

Battery monitoring can be useful in electric mobility test settings, stationary storage and backup-power systems, and industrial battery-bank maintenance. These are potential applications for this architecture, not deployments completed by Tarang.

The current software presents telemetry in one dashboard, stores history and records configured risk alerts. Operators could use those records to review an abnormal reading and trace whether it followed a load or temperature change. The system does not establish that an incident was prevented or that safety improved.

The API includes a device identifier and per-device query paths, which gives a starting point for monitoring more than one unit. The current telemetry contract has four fixed temperature channels. Adding modules, sensor types or additional channels would require schema and interface changes. Database migration and operational load testing would also be needed before expanding beyond the prototype.

Before use outside a lab, the team needs to choose sensors compatible with the pack, calibrate them, verify wiring and controller behavior, test network loss and stale readings, and set thresholds from cell specifications. The 55 degree demo threshold must not be treated as a deployment limit.

**Likely judge question:** Is it deployed in an EV or grid system? No. Those are target environments after integration, calibration, and safety review. There is no field test or customer deployment in the repository.

**Repository sources:** docs/ARCHITECTURE.md; docs/API.md; hardware/README.md; frontend2/app.js; backend/app/schemas/telemetry.py.

## Slide 4 — Conclusion (60 seconds)

The next milestone is physical integration, followed by calibration against appropriate reference instruments. The team should record voltage, current and temperature error rather than assume sensor accuracy from a part datasheet. It should also measure how long a sample takes to reach the API and dashboard, and how often delivery succeeds under normal and degraded network conditions.

Fault tests should use controlled inputs around thresholds agreed from actual cell and pack specifications. The current threshold in the demo configuration is not a verified trip point. The team should test stale or missing samples, out-of-range values, and alert clearing behavior before connecting any real actuator.

The six validation measures on the slide are proposed. No values have been collected yet. Reliability and safety review must precede any field deployment, with the physical BMS retaining protection authority.

Our vision is to connect reliable battery measurements with a clear, scalable and thoroughly validated monitoring experience. We are Tarang.

**Likely judge question:** What are the accuracy, latency, delivery-rate, or detection results? The team has not measured them. Share numbers only after controlled tests document the method and reference equipment.

**Repository sources:** hardware/README.md; docs/ARCHITECTURE.md; docs/API.md; backend/app/core/config.py; backend/app/services/risk_service.py.
