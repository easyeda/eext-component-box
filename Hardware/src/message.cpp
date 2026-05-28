#include "message.h"
#include "config.h"
#include "grid.h"
#include "oled.h"
#include "led.h"
#include "settings.h"
#include "comm.h"
#include "buttons.h"
#include <ArduinoJson.h>
#include <NeoPixelBus.h>

bool syncing = false;
int syncCount = 0;

void on_rx(const char *s) {
    lastActivityMs = millis();
    lastLedActivityMs = millis();
    if (screenSleeping) {
        screenSleeping = false;
        u8g2.setPowerSave(0);
        update_oled();
        update_leds_now();
    }

    JsonDocument doc;
    if (deserializeJson(doc, s)) return;
    const char *t = doc["type"];
    if (!t) return;

    if (strcmp(t, "info") == 0) {
        int r = doc["row"] | cur_r;
        int c = doc["col"] | cur_c;
        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
            Cell &cl = grid[r][c];
            if (doc["name"]) strlcpy(cl.name, doc["name"].as<const char*>(), sizeof(cl.name));
            if (doc["qty"]) cl.qty = doc["qty"];
            if (doc["lcscId"]) strlcpy(cl.id, doc["lcscId"].as<const char*>(), sizeof(cl.id));
            cl.valid = true;
            if (r == cur_r && c == cur_c && appMode == MODE_NORMAL) update_oled();
            save_grid_nvs();
        }
    } else if (strcmp(t, "led") == 0) {
        int r = doc["row"], c = doc["col"];
        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
            leds[r][c].r = doc["r"] | 0;
            leds[r][c].g = doc["g"] | 0;
            leds[r][c].b = doc["b"] | 0;
            leds[r][c].on = (leds[r][c].r + leds[r][c].g + leds[r][c].b) > 0;
        }
    } else if (strcmp(t, "goto") == 0) {
        int r = doc["row"], c = doc["col"];
        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
            cur_r = r;
            cur_c = c;
            if (appMode == MODE_NORMAL) update_oled();
        }
    } else if (strcmp(t, "getcursor") == 0) {
        send_cursor("cursor");
    } else if (strcmp(t, "dec") == 0) {
        decrement_current_qty();
    } else if (strcmp(t, "sync") == 0) {
        int r = doc["row"] | cur_r;
        int c = doc["col"] | cur_c;
        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
            Cell &cl = grid[r][c];
            if (doc["name"]) strlcpy(cl.name, doc["name"].as<const char*>(), sizeof(cl.name));
            if (doc["qty"]) cl.qty = doc["qty"];
            if (doc["lcscId"]) strlcpy(cl.id, doc["lcscId"].as<const char*>(), sizeof(cl.id));
            cl.valid = true;
            save_grid_nvs();
            syncing = true;
            syncCount++;
            strip.SetPixelColor(grid_to_led(r, c), RgbColor(0, 255, 0));
            strip.Show();
            u8g2.clearBuffer();
            u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
            char line1[32]; snprintf(line1, sizeof(line1), langStr("同步中 %d", "Syncing %d"), syncCount);
            u8g2.drawUTF8(0, 14, line1);
            u8g2.drawUTF8(0, 34, cl.name);
            char line3[32]; snprintf(line3, sizeof(line3), "%d-%d", c + 1, r + 1);
            u8g2.setFont(u8g2_font_6x10_tr);
            u8g2.drawStr(0, 54, line3);
            if (connType) {
                const char *badge = (connType == 'B') ? "BLE" : "USB";
                u8g2.drawStr(128 - u8g2.getStrWidth(badge) - 2, 9, badge);
            }
            u8g2.sendBuffer();
            send_oled_mirror(line1, cl.name, line3);
            JsonDocument resp;
            resp["type"] = "qtyreport";
            resp["row"] = r;
            resp["col"] = c;
            resp["qty"] = cl.qty;
            send_json(resp);
        }
    } else if (strcmp(t, "synccomplete") == 0) {
        syncing = false;
        syncCount = 0;
        update_leds_now();
        update_oled();
        JsonDocument resp;
        resp["type"] = "synccomplete";
        send_json(resp);
    } else if (strcmp(t, "showinfo") == 0) {
        u8g2.clearBuffer();
        u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
        char ml1[64] = {}, ml2[32] = {}, ml3[64] = {};
        if (doc["name"]) { u8g2.drawUTF8(0, 14, doc["name"].as<const char*>()); strlcpy(ml1, doc["name"].as<const char*>(), sizeof(ml1)); }
        char buf[32]; snprintf(buf, sizeof(buf), langStr("数量: %d", "Qty: %d"), doc["qty"] | 0);
        u8g2.drawUTF8(0, 34, buf); strlcpy(ml2, buf, sizeof(ml2));
        if (doc["lcscId"]) { u8g2.drawUTF8(0, 54, doc["lcscId"].as<const char*>()); strlcpy(ml3, doc["lcscId"].as<const char*>(), sizeof(ml3)); }
        u8g2.sendBuffer();
        send_oled_mirror(ml1, ml2, ml3);
    } else if (strcmp(t, "shownotfound") == 0) {
        u8g2.clearBuffer();
        u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
        u8g2.drawUTF8(0, 30, langStr("器件库无此器件", "Not in library"));
        u8g2.sendBuffer();
        send_oled_mirror(langStr("器件库无此器件", "Not in library"), "", "");
    } else if (strcmp(t, "clear") == 0) {
        int r = doc["row"], c = doc["col"];
        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
            leds[r][c] = {};
            if (grid[r][c].valid) { grid[r][c] = {}; }
            save_grid_nvs();
            if (syncing) {
                syncCount++;
                u8g2.clearBuffer();
                u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
                char line1[32]; snprintf(line1, sizeof(line1), langStr("同步中 %d", "Syncing %d"), syncCount);
                u8g2.drawUTF8(0, 14, line1);
                u8g2.drawUTF8(0, 34, langStr("(空)", "(Empty)"));
                char line3[32]; snprintf(line3, sizeof(line3), "%d-%d", c + 1, r + 1);
                u8g2.setFont(u8g2_font_6x10_tr);
                u8g2.drawStr(0, 54, line3);
                if (connType) {
                    const char *badge = (connType == 'B') ? "BLE" : "USB";
                    u8g2.drawStr(128 - u8g2.getStrWidth(badge) - 2, 9, badge);
                }
                u8g2.sendBuffer();
                send_oled_mirror(line1, langStr("(空)", "(Empty)"), line3);
            } else {
                if (appMode == MODE_NORMAL) update_oled();
            }
        }
    } else if (strcmp(t, "stoggle") == 0) {
        if (appMode == MODE_NORMAL) enter_settings();
        else exit_settings();
    } else if (strcmp(t, "snav") == 0) {
        const char *dir = doc["dir"];
        if (!dir) return;
        if (strcmp(dir, "up") == 0) {
            if (appMode == MODE_SETTINGS_LIST) {
                settingsCursor = (settingsCursor - 1 + SETTINGS_COUNT) % SETTINGS_COUNT;
                update_oled_settings();
            } else if (appMode == MODE_SETTINGS_EDIT) {
                settings_nav_up();
            }
        } else if (strcmp(dir, "down") == 0) {
            if (appMode == MODE_SETTINGS_LIST) {
                settingsCursor = (settingsCursor + 1) % SETTINGS_COUNT;
                update_oled_settings();
            } else if (appMode == MODE_SETTINGS_EDIT) {
                settings_nav_down();
            }
        } else if (strcmp(dir, "ok") == 0) {
            settings_nav_ok();
        }
    }
}
