// Sensor-free connectivity smoke test. All readings below are simulated test data.
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <cstring>

#include "secrets.h"
#include "server_root_ca.h"

static const char *TEST_PAYLOAD =
    "{\"device_id\":\"EVG-ESP32-SMOKE-TEST\",\"voltage\":3.91,\"current\":0.25,\"soc\":50.0,"
    "\"temperatures\":{\"cell_1\":25.0,\"cell_2\":25.0,\"cell_3\":25.0,\"cell_4\":25.0},\"source\":\"test\"}";

static constexpr unsigned long SUCCESS_INTERVAL_MS = 30000;
static constexpr unsigned long MAX_BACKOFF_MS = 300000;
static unsigned long nextAttemptAt = 0;
static unsigned long retryDelayMs = 2000;
static bool stoppedOnClientError = false;

static bool hasConfiguredInputs() {
  return strlen(WIFI_SSID) > 0 && strlen(WIFI_PASSWORD) > 0 &&
         strlen(EVG_DEVICE_TOKEN) >= 32 && strlen(EVG_API_URL) > 8 &&
         strlen(SERVER_ROOT_CA) > 100 && String(EVG_API_URL).startsWith("https://") &&
         strcmp(WIFI_SSID, "YOUR_WIFI_NAME") != 0 &&
         strcmp(EVG_DEVICE_TOKEN, "REPLACE_WITH_GENERATED_32_PLUS_CHARACTER_TOKEN") != 0 &&
         String(EVG_API_URL).indexOf("YOUR_") < 0 &&
         strstr(SERVER_ROOT_CA, "REPLACE_WITH") == nullptr;
}

static void scheduleRetry() {
  nextAttemptAt = millis() + retryDelayMs;
  retryDelayMs = min(retryDelayMs * 2, MAX_BACKOFF_MS);
}

void setup() {
  Serial.begin(115200);
  if (!hasConfiguredInputs()) {
    Serial.println("Configure local Wi-Fi, API token, HTTPS URL, and trusted root CA first.");
    stoppedOnClientError = true;
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("Connecting to Wi-Fi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  Serial.println("Wi-Fi connected. This sketch sends explicitly simulated TEST telemetry only.");
}

void loop() {
  if (stoppedOnClientError) {
    delay(100);
    return;
  }
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
    scheduleRetry();
    Serial.println("Wi-Fi disconnected; reconnect requested with bounded retry delay.");
    delay(100);
    return;
  }
  if (static_cast<long>(millis() - nextAttemptAt) < 0) {
    delay(100);
    return;
  }

  WiFiClientSecure tlsClient;
  tlsClient.setCACert(SERVER_ROOT_CA);  // Certificate verification remains enabled.
  HTTPClient http;
  if (!http.begin(tlsClient, EVG_API_URL)) {
    Serial.println("HTTPS setup failed; retrying with bounded backoff.");
    scheduleRetry();
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + EVG_DEVICE_TOKEN);
  const int status = http.POST(TEST_PAYLOAD);
  if (status == 201) {
    Serial.println("HTTP 201: simulated test sample stored.");
    retryDelayMs = 2000;
    nextAttemptAt = millis() + SUCCESS_INTERVAL_MS;
  } else if (status == 401 || status == 422) {
    Serial.printf("HTTP %d: configuration or payload rejected; fix it before retrying.\n", status);
    stoppedOnClientError = true;
  } else if (status < 0 || status == 429 || status >= 500) {
    Serial.printf("Retryable network/server failure (%d); bounded backoff scheduled.\n", status);
    scheduleRetry();
  } else {
    Serial.printf("HTTP %d: request not accepted; inspect API response before retrying.\n", status);
    stoppedOnClientError = true;
  }
  http.end();
}
