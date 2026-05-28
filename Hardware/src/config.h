#pragma once

// ===== Hardware Pins =====
#define LED_GPIO        48
#define LED_COUNT       35
#define GRID_ROWS       5
#define GRID_COLS       7

#define OLED_SDA        40
#define OLED_SCL        39

#define BTN_DOWN        15
#define BTN_LEFT        41
#define BTN_CENTER      42
#define BTN_RIGHT       45
#define BTN_UP          46

// ===== Timing =====
#define DEBOUNCE_MS     50
#define LED_ANIM_MS     33  // ~30fps
#define LONG_PRESS_MS   500
#define CONN_TIMEOUT_MS 3000

// ===== BLE UUIDs =====
#define BLE_SERVICE_UUID    "0000ffe0-0000-1000-8000-00805f9b34fb"
#define BLE_CHAR_TX_UUID    "0000ffe1-0000-1000-8000-00805f9b34fb"
#define BLE_CHAR_RX_UUID    "0000ffe2-0000-1000-8000-00805f9b34fb"

// ===== Shared global state (defined in main.cpp) =====
extern bool screenSleeping;
extern unsigned long lastActivityMs;
