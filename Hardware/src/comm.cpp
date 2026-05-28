#include "comm.h"
#include "ble.h"
#include "config.h"
#include "grid.h"
#include "settings.h"
#include "oled.h"
#include <ArduinoJson.h>

char connType = 0; // 0=none, 'B'=BLE, 'U'=USB
unsigned long lastConnMs = 0;

static char rbuf[512];
static int rpos = 0;

void on_rx(const char *s); // from message.h/.cpp

void send_json(JsonDocument &doc) {
    serializeJson(doc, Serial); Serial.println();
    ble_send_json(doc);
}

void send_cursor(const char *type) {
    JsonDocument doc;
    doc["type"] = type;
    doc["row"] = cur_r;
    doc["col"] = cur_c;
    send_json(doc);
}

void send_oled_mirror(const char *l1, const char *l2, const char *l3) {
    JsonDocument doc;
    doc["type"] = "oled";
    doc["l1"] = l1;
    doc["l2"] = l2;
    doc["l3"] = l3;
    send_json(doc);
}

void send_mode(const char *mode) {
    JsonDocument doc;
    doc["type"] = "mode";
    doc["mode"] = mode;
    send_json(doc);
}

void send_settings_values() {
    JsonDocument doc;
    doc["type"] = "settings";
    doc["colorIdx"] = settings.colorIdx;
    doc["brightIdx"] = settings.brightIdx;
    doc["idleEffect"] = settings.idleEffect;
    doc["idleTimeoutIdx"] = settings.idleTimeoutIdx;
    doc["cursorEffect"] = settings.cursorEffect;
    doc["contrast"] = settings.contrast;
    doc["timeoutIdx"] = settings.timeoutIdx;
    doc["bleOn"] = settings.bleOn;
    doc["lang"] = settings.lang;
    send_json(doc);
}

void read_serial() {
    while (Serial.available()) {
        char ch = Serial.read();
        if (ch == '\n' || ch == '\r') {
            if (rpos > 0) { rbuf[rpos] = 0; connType = 'U'; lastConnMs = millis(); on_rx(rbuf); rpos = 0; }
        } else if (rpos < (int)sizeof(rbuf) - 1) {
            rbuf[rpos++] = ch;
        }
    }
}

void check_conn_timeout() {
    if (connType && lastConnMs && (millis() - lastConnMs > CONN_TIMEOUT_MS)) {
        connType = 0;
        lastConnMs = 0;
        if (appMode == MODE_NORMAL) update_oled();
    }
}
