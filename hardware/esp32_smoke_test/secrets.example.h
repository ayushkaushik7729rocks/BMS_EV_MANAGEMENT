// Copy to secrets.h (ignored by Git) and replace every placeholder locally.
// Never commit secrets.h or print EVG_DEVICE_TOKEN to Serial.
#pragma once

static const char *WIFI_SSID = "YOUR_WIFI_NAME";
static const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
static const char *EVG_DEVICE_TOKEN = "REPLACE_WITH_GENERATED_32_PLUS_CHARACTER_TOKEN";
static const char *EVG_API_URL = "https://YOUR_REAL_DOMAIN/api/telemetry";
