#pragma once
#include "config.h"
#include <stdint.h>

#define SETTINGS_COUNT      11
#define COLOR_PRESET_COUNT  7
#define IDLE_EFFECT_COUNT   5
#define IDLE_TIMEOUT_COUNT  6
#define CURSOR_EFFECT_COUNT 4
#define TIMEOUT_OPT_COUNT   7

extern const uint8_t colorPresets[COLOR_PRESET_COUNT][3];
extern const char *colorNames[COLOR_PRESET_COUNT];
extern const char *colorNamesEn[COLOR_PRESET_COUNT];
extern const char *idleEffectNames[IDLE_EFFECT_COUNT];
extern const char *idleEffectNamesEn[IDLE_EFFECT_COUNT];
extern const int idleTimeouts[IDLE_TIMEOUT_COUNT];
extern const char *cursorEffectNames[CURSOR_EFFECT_COUNT];
extern const char *cursorEffectNamesEn[CURSOR_EFFECT_COUNT];
extern const char *settingsNames[SETTINGS_COUNT];
extern const char *settingsNamesEn[SETTINGS_COUNT];
extern const int timeoutOptions[TIMEOUT_OPT_COUNT];

const char* langStr(const char* zh, const char* en);
const char* colorName(int idx);
const char* idleEffectName(int idx);
const char* cursorEffectName(int idx);
const char* settingsName(int idx);

struct Settings {
    int colorIdx = 1;
    int brightIdx = 8;
    int idleEffect = 0;
    int idleTimeoutIdx = 0;
    int cursorEffect = 0;
    int contrast = 127;
    int timeoutIdx = 4;
    bool bleOn = true;
    int lang = 0; // 0=中文, 1=English
};

enum AppMode { MODE_NORMAL, MODE_SETTINGS_LIST, MODE_SETTINGS_EDIT };

extern Settings settings;
extern AppMode appMode;
extern int settingsCursor;

void save_settings_nvs();
void load_settings_nvs();
void enter_settings();
void exit_settings();
void settings_nav_up();
void settings_nav_down();
void settings_nav_ok();
