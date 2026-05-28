#include "settings.h"
#include "oled.h"
#include "led.h"
#include "comm.h"
#include "ble.h"
#include <Arduino.h>
#include <NimBLEDevice.h>
#include <nvs_flash.h>
#include <nvs.h>

Settings settings;
AppMode appMode = MODE_NORMAL;
int settingsCursor = 0;

const uint8_t colorPresets[COLOR_PRESET_COUNT][3] = {
    {255, 0, 0}, {0, 255, 0}, {0, 0, 255}, {255, 255, 0},
    {255, 0, 255}, {255, 255, 255}, {255, 165, 0}
};
const char *colorNames[COLOR_PRESET_COUNT] = {"红","绿","蓝","黄","紫","白","橙"};
const char *colorNamesEn[COLOR_PRESET_COUNT] = {"Red","Green","Blue","Yellow","Purple","White","Orange"};
const char *idleEffectNames[IDLE_EFFECT_COUNT] = {"关闭","彩虹","波涛","呼吸","渐变"};
const char *idleEffectNamesEn[IDLE_EFFECT_COUNT] = {"Off","Rainbow","Wave","Breathing","Gradient"};
const int idleTimeouts[IDLE_TIMEOUT_COUNT] = {3, 5, 10, 15, 30, 60};
const char *cursorEffectNames[CURSOR_EFFECT_COUNT] = {"静态","闪烁","呼吸","渐变"};
const char *cursorEffectNamesEn[CURSOR_EFFECT_COUNT] = {"Static","Blink","Breathing","Gradient"};
const char *settingsNames[SETTINGS_COUNT] = {
    "灯光颜色", "灯光亮度", "空闲灯效", "空闲时间",
    "光标灯效", "屏幕对比度", "熄屏倒计时", "蓝牙开关", "语言切换", "重新配对", "退出设置"
};
const char *settingsNamesEn[SETTINGS_COUNT] = {
    "LED Color", "Brightness", "Idle Effect", "Idle Time",
    "Cursor Effect", "Contrast", "Sleep Timer", "Bluetooth", "Language", "Re-pair", "Exit Settings"
};
const int timeoutOptions[TIMEOUT_OPT_COUNT] = {0, 1, 2, 5, 10, 15, 30};

const char* langStr(const char* zh, const char* en) {
    return settings.lang == 1 ? en : zh;
}

const char* colorName(int idx) {
    return settings.lang == 1 ? colorNamesEn[idx] : colorNames[idx];
}

const char* idleEffectName(int idx) {
    return settings.lang == 1 ? idleEffectNamesEn[idx] : idleEffectNames[idx];
}

const char* cursorEffectName(int idx) {
    return settings.lang == 1 ? cursorEffectNamesEn[idx] : cursorEffectNames[idx];
}

const char* settingsName(int idx) {
    return settings.lang == 1 ? settingsNamesEn[idx] : settingsNames[idx];
}

void save_settings_nvs() {
    nvs_handle_t h;
    if (nvs_open("boxset", NVS_READWRITE, &h) != ESP_OK) return;
    nvs_set_i32(h, "colorIdx", settings.colorIdx);
    nvs_set_i32(h, "brightIdx", settings.brightIdx);
    nvs_set_i32(h, "idleFx", settings.idleEffect);
    nvs_set_i32(h, "idleTm", settings.idleTimeoutIdx);
    nvs_set_i32(h, "curFx", settings.cursorEffect);
    nvs_set_i32(h, "contrast", settings.contrast);
    nvs_set_i32(h, "timeoutIdx", settings.timeoutIdx);
    nvs_set_i8(h, "bleOn", settings.bleOn ? 1 : 0);
    nvs_set_i32(h, "lang", settings.lang);
    nvs_commit(h);
    nvs_close(h);
}

void load_settings_nvs() {
    nvs_handle_t h;
    if (nvs_open("boxset", NVS_READONLY, &h) != ESP_OK) return;
    int32_t val;
    if (nvs_get_i32(h, "colorIdx", &val) == ESP_OK)
        settings.colorIdx = constrain(val, 0, COLOR_PRESET_COUNT - 1);
    if (nvs_get_i32(h, "brightIdx", &val) == ESP_OK)
        settings.brightIdx = constrain(val, 1, 10);
    if (nvs_get_i32(h, "idleFx", &val) == ESP_OK)
        settings.idleEffect = constrain(val, 0, IDLE_EFFECT_COUNT - 1);
    if (nvs_get_i32(h, "idleTm", &val) == ESP_OK)
        settings.idleTimeoutIdx = constrain(val, 0, IDLE_TIMEOUT_COUNT - 1);
    if (nvs_get_i32(h, "curFx", &val) == ESP_OK)
        settings.cursorEffect = constrain(val, 0, CURSOR_EFFECT_COUNT - 1);
    if (nvs_get_i32(h, "contrast", &val) == ESP_OK)
        settings.contrast = constrain(val, 50, 255);
    if (nvs_get_i32(h, "timeoutIdx", &val) == ESP_OK)
        settings.timeoutIdx = constrain(val, 0, TIMEOUT_OPT_COUNT - 1);
    int8_t bval;
    if (nvs_get_i8(h, "bleOn", &bval) == ESP_OK)
        settings.bleOn = (bval != 0);
    if (nvs_get_i32(h, "lang", &val) == ESP_OK)
        settings.lang = constrain(val, 0, 1);
    nvs_close(h);
}

void enter_settings() {
    appMode = MODE_SETTINGS_LIST;
    settingsCursor = 0;
    update_oled_settings();
    send_mode("settings");
    send_settings_values();
}

void exit_settings() {
    save_settings_nvs();
    appMode = MODE_NORMAL;
    update_leds_now();
    update_oled();
    send_mode("normal");
}

void settings_nav_up() {
    switch (settingsCursor) {
        case 0: settings.colorIdx = (settings.colorIdx - 1 + COLOR_PRESET_COUNT) % COLOR_PRESET_COUNT; break;
        case 1: settings.brightIdx = constrain(settings.brightIdx - 1, 1, 10); break;
        case 2: settings.idleEffect = (settings.idleEffect - 1 + IDLE_EFFECT_COUNT) % IDLE_EFFECT_COUNT; break;
        case 3: settings.idleTimeoutIdx = (settings.idleTimeoutIdx - 1 + IDLE_TIMEOUT_COUNT) % IDLE_TIMEOUT_COUNT; break;
        case 4: settings.cursorEffect = (settings.cursorEffect - 1 + CURSOR_EFFECT_COUNT) % CURSOR_EFFECT_COUNT; break;
        case 5: settings.contrast = constrain(settings.contrast - 10, 50, 255); break;
        case 6: settings.timeoutIdx = (settings.timeoutIdx - 1 + TIMEOUT_OPT_COUNT) % TIMEOUT_OPT_COUNT; break;
        case 7: settings.bleOn = !settings.bleOn; break;
        case 8: settings.lang = (settings.lang == 0) ? 1 : 0; break;
    }
    update_oled_settings();
}

void settings_nav_down() {
    switch (settingsCursor) {
        case 0: settings.colorIdx = (settings.colorIdx + 1) % COLOR_PRESET_COUNT; break;
        case 1: settings.brightIdx = constrain(settings.brightIdx + 1, 1, 10); break;
        case 2: settings.idleEffect = (settings.idleEffect + 1) % IDLE_EFFECT_COUNT; break;
        case 3: settings.idleTimeoutIdx = (settings.idleTimeoutIdx + 1) % IDLE_TIMEOUT_COUNT; break;
        case 4: settings.cursorEffect = (settings.cursorEffect + 1) % CURSOR_EFFECT_COUNT; break;
        case 5: settings.contrast = constrain(settings.contrast + 10, 50, 255); break;
        case 6: settings.timeoutIdx = (settings.timeoutIdx + 1) % TIMEOUT_OPT_COUNT; break;
        case 7: settings.bleOn = !settings.bleOn; break;
        case 8: settings.lang = (settings.lang == 0) ? 1 : 0; break;
    }
    update_oled_settings();
}

void settings_nav_ok() {
    if (settingsCursor == SETTINGS_COUNT - 1) {
        exit_settings();
    } else if (settingsCursor == 9) {
        // 重新配对: full BLE stack reset
        oled_draw_text(langStr("正在重置蓝牙...", "Resetting BLE..."), "", "");
        NimBLEDevice::stopAdvertising();
        NimBLEDevice::deleteAllBonds();
        NimBLEDevice::deinit(true);
        delay(200);
        setup_ble();
        connType = 0;
        settings.bleOn = true;
        save_settings_nvs();
        oled_draw_text(langStr("蓝牙已重置", "BLE Reset"), langStr("请重新配对", "Re-pair now"), "");
        delay(1500);
        appMode = MODE_SETTINGS_LIST;
        update_oled_settings();
    } else if (appMode == MODE_SETTINGS_LIST) {
        appMode = MODE_SETTINGS_EDIT;
        update_oled_settings();
    } else if (appMode == MODE_SETTINGS_EDIT) {
        if (settingsCursor == 7) {
            if (settings.bleOn) NimBLEDevice::startAdvertising();
            else NimBLEDevice::stopAdvertising();
        }
        save_settings_nvs();
        send_settings_values();
        appMode = MODE_SETTINGS_LIST;
        update_oled_settings();
    }
}
