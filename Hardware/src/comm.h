#pragma once
#include <ArduinoJson.h>

extern char connType;
extern unsigned long lastConnMs;

void send_json(JsonDocument &doc);
void send_cursor(const char *type);
void send_oled_mirror(const char *l1, const char *l2, const char *l3);
void send_mode(const char *mode);
void send_settings_values();
void read_serial();
void check_conn_timeout();
