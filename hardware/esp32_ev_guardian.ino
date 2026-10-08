/*
 * EV Guardian AI / TARANG - ESP32 telemetry firmware
 *
 * Backend contract: POST one JSON record to /api/telemetry every 5 seconds.
 * This firmware performs sensor acquisition, approximate coulomb-count SOC,
 * OLED display, and local demonstration outputs. Predictive inference remains
 * in the Python backend; it is advisory and never replaces a physical BMS.
 *
 * Prototype assumption: four matched 18650 cells configured as a protected
 * 1S4P pack. The INA219 measures pack voltage/current, not individual cell
 * voltages. Do not use this sketch as a traction-pack or safety controller.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_INA219.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <time.h>

// --------------------------- User configuration ---------------------------
const char *WIFI_SSID = "YOUR_WIFI_NAME";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Use the computer's LAN IPv4 address, not 127.0.0.1 or localhost.
// Example: http://192.168.1.25:8000/api/telemetry
const char *API_URL = "http://192.168.1.25:8000/api/telemetry";
const char *DEVICE_ID = "EVG-001";  // Must match backend DEVICE_ID.

// For four 3 Ah cells in parallel, nominal pack capacity is about 12 Ah.
// Set the actual rated capacity and initialize SOC to a known estimate.
const float PACK_CAPACITY_AH = 12.0f;
const float INITIAL_SOC_PERCENT = 80.0f;

// These are demonstration settings only. Set backend COOLING_ACTIVATION_C
// to the same cooling value. Use cell-maker limits for all real protections.
const float COOLING_START_C = 34.1f;
const float DEMO_ALERT_C = 40.0f;

// INA219 Adafruit 32V/2A calibration; keep prototype current within the
// breakout/shunt rating and the selected calibration range.
const float INA219_MAX_EXPECTED_CURRENT_A = 2.0f;

// ------------------------------- Pin map ----------------------------------
constexpr uint8_t PIN_I2C_SDA = 21;
constexpr uint8_t PIN_I2C_SCL = 22;
constexpr uint8_t PIN_ONEWIRE = 4;       // Four DS18B20s share this bus.
constexpr uint8_t PIN_FAN_MOSFET = 25;   // Logic-level N-MOSFET gate driver.
constexpr uint8_t PIN_DEMO_RELAY = 26;   // Auxiliary low-voltage demo load only.
constexpr uint8_t PIN_BUZZER = 27;       // Drive buzzer through an NPN transistor.

// Many relay modules are active-low. Change this if your module is active-high.
constexpr bool RELAY_ACTIVE_LOW = true;
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr uint8_t INA219_ADDRESS = 0x40;
constexpr uint8_t OLED_WIDTH = 128;
constexpr uint8_t OLED_HEIGHT = 64;

constexpr uint32_t SENSOR_INTERVAL_MS = 1000;
constexpr uint32_t TELEMETRY_INTERVAL_MS = 5000;
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 10000;
constexpr uint32_t HTTP_TIMEOUT_MS = 3000;
constexpr float CURRENT_NOISE_FLOOR_A = 0.03f;

OneWire oneWire(PIN_ONEWIRE);
DallasTemperature temperatureBus(&oneWire);
Adafruit_INA219 ina219(INA219_ADDRESS);
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);

bool oledReady = false;
bool inaReady = false;
bool sensorCountReady = false;
bool sensorFault = true;
bool electricalFault = true;
float cellTempsC[4] = {NAN, NAN, NAN, NAN};
float packVoltageV = NAN;
float packCurrentA = NAN;
float packPowerW = NAN;
float socPercent = INITIAL_SOC_PERCENT;
uint32_t lastSensorReadMs = 0;
uint32_t lastTelemetryMs = 0;
uint32_t lastWiFiAttemptMs = 0;
uint32_t lastSocUpdateMs = 0;

void setRelay(bool active) {
  const uint8_t activeLevel = RELAY_ACTIVE_LOW ? LOW : HIGH;
  const uint8_t inactiveLevel = RELAY_ACTIVE_LOW ? HIGH : LOW;
  digitalWrite(PIN_DEMO_RELAY, active ? activeLevel : inactiveLevel);
}

bool allFiniteTemperatures() {
  for (uint8_t i = 0; i < 4; ++i) {
    if (!isfinite(cellTempsC[i])) return false;
  }
  return true;
}

float maximumTemperatureC() {
  float maximum = cellTempsC[0];
  for (uint8_t i = 1; i < 4; ++i) maximum = max(maximum, cellTempsC[i]);
  return maximum;
}

void printRomAddress(DeviceAddress address) {
  for (uint8_t i = 0; i < 8; ++i) {
    if (address[i] < 16) Serial.print('0');
    Serial.print(address[i], HEX);
  }
}

void connectWiFiIfNeeded() {
  if (WiFi.status() == WL_CONNECTED) return;
  const uint32_t now = millis();
  if (lastWiFiAttemptMs != 0 && now - lastWiFiAttemptMs < WIFI_RETRY_INTERVAL_MS) return;
  lastWiFiAttemptMs = now;
  Serial.printf("Connecting to Wi-Fi SSID: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void updateSoc(float currentA, uint32_t nowMs) {
  if (lastSocUpdateMs == 0) {
    lastSocUpdateMs = nowMs;
    return;
  }
  const float elapsedHours = (nowMs - lastSocUpdateMs) / 3600000.0f;
  lastSocUpdateMs = nowMs;
  if (elapsedHours <= 0.0f || PACK_CAPACITY_AH <= 0.0f) return;

  // Current is positive from battery to load (discharge) with the wiring below.
  // Small sensor offsets are ignored to reduce idle coulomb-count drift.
  if (fabs(currentA) < CURRENT_NOISE_FLOOR_A) currentA = 0.0f;
  socPercent -= (currentA * elapsedHours / PACK_CAPACITY_AH) * 100.0f;
  socPercent = constrain(socPercent, 0.0f, 100.0f);
}

bool readTemperatures() {
  if (!sensorCountReady || temperatureBus.getDeviceCount() < 4) return false;

  temperatureBus.requestTemperatures();  // 12-bit conversion may take up to 750 ms.
  for (uint8_t i = 0; i < 4; ++i) {
    const float value = temperatureBus.getTempCByIndex(i);
    // -127 means missing device; 85 C is the DS18B20 power-up sentinel.
    if (!isfinite(value) || value == DEVICE_DISCONNECTED_C || value == 85.0f ||
        value < -55.0f || value > 125.0f) {
      cellTempsC[i] = NAN;
      return false;
    }
    cellTempsC[i] = value;
  }
  return true;
}

bool readElectricals(uint32_t nowMs) {
  if (!inaReady) {
    electricalFault = true;
    return false;
  }

  // With battery positive on VIN+ and load positive on VIN-, add shunt drop
  // back to INA219's VIN- bus reading to estimate pack-side voltage.
  const float busVoltage = ina219.getBusVoltage_V();
  const float shuntVoltage = ina219.getShuntVoltage_mV() / 1000.0f;
  packVoltageV = busVoltage + shuntVoltage;
  packCurrentA = ina219.getCurrent_mA() / 1000.0f;
  packPowerW = packVoltageV * packCurrentA;
  updateSoc(packCurrentA, nowMs);

  electricalFault = !isfinite(packVoltageV) || !isfinite(packCurrentA) ||
                    packVoltageV <= 0.0f || fabs(packCurrentA) > INA219_MAX_EXPECTED_CURRENT_A;
  return !electricalFault;
}

void updateLocalDemoOutputs() {
  const bool temperaturesValid = allFiniteTemperatures();
  sensorFault = !temperaturesValid || electricalFault;
  const float hottest = temperaturesValid ? maximumTemperatureC() : NAN;

  // Fault handling is conservative: fail sensor loss visibly and run the
  // demonstration fan. This is not a substitute for a certified pack BMS.
  const bool fanOn = sensorFault || hottest >= COOLING_START_C;
  const bool alertOn = sensorFault || hottest >= DEMO_ALERT_C;
  digitalWrite(PIN_FAN_MOSFET, fanOn ? HIGH : LOW);
  setRelay(alertOn);
  digitalWrite(PIN_BUZZER, alertOn ? HIGH : LOW);
}

String utcTimestampOrEmpty() {
  const time_t epoch = time(nullptr);
  if (epoch < 1700000000) return "";  // Let the API timestamp it until NTP sync.
  struct tm utc;
  gmtime_r(&epoch, &utc);
  char buffer[25];
  snprintf(buffer, sizeof(buffer), "%04d-%02d-%02dT%02d:%02d:%02dZ",
           utc.tm_year + 1900, utc.tm_mon + 1, utc.tm_mday,
           utc.tm_hour, utc.tm_min, utc.tm_sec);
  return String(buffer);
}

String buildTelemetryJson() {
  String json;
  json.reserve(320);
  json += "{\"device_id\":\"";
  json += DEVICE_ID;
  json += "\",\"voltage\":" + String(packVoltageV, 3);
  json += ",\"current\":" + String(packCurrentA, 3);
  json += ",\"power\":" + String(packPowerW, 3);
  json += ",\"soc\":" + String(socPercent, 2);
  json += ",\"temperatures\":{\"cell_1\":" + String(cellTempsC[0], 2);
  json += ",\"cell_2\":" + String(cellTempsC[1], 2);
  json += ",\"cell_3\":" + String(cellTempsC[2], 2);
  json += ",\"cell_4\":" + String(cellTempsC[3], 2) + "}";
  json += ",\"source\":\"hardware\"";
  const String timestamp = utcTimestampOrEmpty();
  if (timestamp.length() > 0) {
    json += ",\"timestamp\":\"" + timestamp + "\"";
  }
  // Do not send SOH/RUL: the current backend has no validated estimator for them.
  json += "}";
  return json;
}

bool postTelemetry() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Telemetry skipped: Wi-Fi disconnected.");
    return false;
  }
  if (sensorFault || !isfinite(packVoltageV) || !isfinite(packCurrentA) ||
      !allFiniteTemperatures()) {
    Serial.println("Telemetry skipped: invalid or missing sensor reading.");
    return false;
  }

  WiFiClient client;
  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (!http.begin(client, API_URL)) {
    Serial.println("HTTP client could not open API URL.");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  const String body = buildTelemetryJson();
  const int status = http.POST(body);
  const String response = status > 0 ? http.getString() : http.errorToString(status);
  Serial.printf("POST /api/telemetry -> %d | %s\n", status, response.c_str());
  http.end();
  return status >= 200 && status < 300;
}

void updateDisplay() {
  if (!oledReady) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("EV Guardian AI | EVG-001");
  display.println(WiFi.status() == WL_CONNECTED ? "Wi-Fi: connected" : "Wi-Fi: offline");
  if (!inaReady) {
    display.println("INA219: NOT FOUND");
  } else {
    display.printf("V %.2f  I %.2f A\n", packVoltageV, packCurrentA);
    display.printf("SOC approx %.1f%%\n", socPercent);
  }
  if (allFiniteTemperatures()) {
    display.printf("T1 %.1f T2 %.1f C\n", cellTempsC[0], cellTempsC[1]);
    display.printf("T3 %.1f T4 %.1f C\n", cellTempsC[2], cellTempsC[3]);
    display.printf("Max %.1f C Fan %s\n", maximumTemperatureC(),
                   (sensorFault || maximumTemperatureC() >= COOLING_START_C) ? "ON" : "OFF");
  } else {
    display.println("TEMP SENSOR FAULT");
  }
  display.display();
}

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(PIN_FAN_MOSFET, OUTPUT);
  pinMode(PIN_DEMO_RELAY, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_FAN_MOSFET, LOW);
  digitalWrite(PIN_BUZZER, LOW);
  setRelay(false);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  oledReady = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);
  if (oledReady) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println("Starting EV Guardian...");
    display.display();
  }

  inaReady = ina219.begin(&Wire);
  if (inaReady) {
    ina219.setCalibration_32V_2A();
    Serial.println("INA219 ready at 0x40 (32V/2A calibration).");
  } else {
    Serial.println("ERROR: INA219 not found at 0x40.");
  }

  temperatureBus.begin();
  temperatureBus.setResolution(12);
  const int deviceCount = temperatureBus.getDeviceCount();
  sensorCountReady = deviceCount >= 4;
  Serial.printf("DS18B20 devices found: %d (need at least 4).\n", deviceCount);
  for (int i = 0; i < min(deviceCount, 4); ++i) {
    DeviceAddress address;
    if (temperatureBus.getAddress(address, i)) {
      Serial.printf("Channel cell_%d ROM: ", i + 1);
      printRomAddress(address);
      Serial.println();
    }
  }
  if (!sensorCountReady) Serial.println("ERROR: add four valid DS18B20 sensors on the 1-Wire bus.");

  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  WiFi.setAutoReconnect(true);
  connectWiFiIfNeeded();
  lastSocUpdateMs = millis();
  lastSensorReadMs = millis() - SENSOR_INTERVAL_MS;
  lastTelemetryMs = millis();
}

void loop() {
  connectWiFiIfNeeded();
  const uint32_t now = millis();

  if (now - lastSensorReadMs >= SENSOR_INTERVAL_MS) {
    lastSensorReadMs = now;
    const bool temperaturesOkay = readTemperatures();
    const bool electricalOkay = readElectricals(now);
    if (!temperaturesOkay) Serial.println("Temperature channel fault; refusing to publish fabricated values.");
    if (!electricalOkay) Serial.println("Electrical reading invalid/out of configured INA219 range.");
    updateLocalDemoOutputs();
    updateDisplay();
  }

  if (now - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = now;
    postTelemetry();
  }
  delay(5);
}
