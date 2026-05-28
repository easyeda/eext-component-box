#pragma once
#include <ArduinoJson.h>

void setup_ble();
void ble_send_json(JsonDocument &doc);

extern bool bleRestartAdv;
