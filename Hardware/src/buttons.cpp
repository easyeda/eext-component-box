#include "buttons.h"
#include "config.h"
#include "grid.h"
#include "oled.h"
#include "led.h"
#include "settings.h"
#include "comm.h"

static const int btns[] = {BTN_UP, BTN_DOWN, BTN_LEFT, BTN_CENTER, BTN_RIGHT};

void buttons_setup() {
    for (int i = 0; i < 5; i++) pinMode(btns[i], INPUT_PULLUP);
}
static bool bprev[5] = {};
static unsigned long blast[5] = {};
static unsigned long centerPressStart = 0;
static bool centerLongFired = false;

void decrement_current_qty() {
    Cell &cl = grid[cur_r][cur_c];
    if (cl.valid && cl.qty > 0) {
        cl.qty--;
        update_oled();
        save_grid_nvs();
    }
}

void handle_btns() {
    unsigned long now = millis();
    for (int i = 0; i < 5; i++) {
        bool p = digitalRead(btns[i]) == LOW;

        if (i == 3) {
            // Center button: long press = settings, short press = decrement qty
            if (p && !bprev[3] && now - blast[3] > DEBOUNCE_MS) {
                blast[3] = now;
                centerPressStart = now;
                centerLongFired = false;
                lastActivityMs = now;
                lastLedActivityMs = now;
                if (screenSleeping) {
                    screenSleeping = false;
                    u8g2.setPowerSave(0);
                    update_oled();
                    update_leds_now();
                    centerLongFired = true;
                }
            }
            // Long press while held
            if (p && !centerLongFired && centerPressStart > 0 && (now - centerPressStart >= LONG_PRESS_MS)) {
                centerLongFired = true;
                if (appMode == MODE_NORMAL) enter_settings();
                else exit_settings();
            }
            // Short press on release
            if (!p && bprev[3] && !centerLongFired && centerPressStart > 0) {
                lastActivityMs = now;
                lastLedActivityMs = now;
                if (appMode == MODE_NORMAL) decrement_current_qty();
                else if (appMode == MODE_SETTINGS_LIST) settings_nav_ok();
                else if (appMode == MODE_SETTINGS_EDIT) settings_nav_ok();
            }
            bprev[3] = p;
            continue;
        }

        // D-pad buttons: edge-triggered press
        if (p && !bprev[i] && now - blast[i] > DEBOUNCE_MS) {
            blast[i] = now;
            lastActivityMs = now;
            lastLedActivityMs = now;
            if (screenSleeping) {
                screenSleeping = false;
                u8g2.setPowerSave(0);
                update_oled();
                update_leds_now();
                bprev[i] = p;
                return;
            }
            if (appMode == MODE_NORMAL) {
                int nr = cur_r, nc = cur_c;
                if (i == 0) nr = (cur_r - 1 + GRID_ROWS) % GRID_ROWS;
                else if (i == 1) nr = (cur_r + 1) % GRID_ROWS;
                else if (i == 2) nc = (cur_c - 1 + GRID_COLS) % GRID_COLS;
                else if (i == 4) nc = (cur_c + 1) % GRID_COLS;
                cur_r = nr;
                cur_c = nc;
                update_oled();
                send_cursor("cursor");
            } else if (appMode == MODE_SETTINGS_LIST) {
                if (i == 0) { settingsCursor = (settingsCursor - 1 + SETTINGS_COUNT) % SETTINGS_COUNT; update_oled_settings(); }
                else if (i == 1) { settingsCursor = (settingsCursor + 1) % SETTINGS_COUNT; update_oled_settings(); }
            } else if (appMode == MODE_SETTINGS_EDIT) {
                if (i == 0) settings_nav_up();
                else if (i == 1) settings_nav_down();
            }
        }
        bprev[i] = p;
    }
}
