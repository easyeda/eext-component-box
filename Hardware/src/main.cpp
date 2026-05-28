#include <Arduino.h>
#include <Wire.h>
#include <nvs_flash.h>
#include <NimBLEDevice.h>

#include "config.h"
#include "grid.h"
#include "settings.h"
#include "led.h"
#include "oled.h"
#include "ble.h"
#include "comm.h"
#include "buttons.h"
#include "message.h"

// Shared global state
bool screenSleeping = false;
unsigned long lastActivityMs = 0;

void check_screen_timeout() {
    if (settings.timeoutIdx == 0) return;
    if (screenSleeping) return;
    if (appMode != MODE_NORMAL) return;
    unsigned long elapsed = (millis() - lastActivityMs) / 60000;
    if (elapsed >= (unsigned long)timeoutOptions[settings.timeoutIdx]) {
        screenSleeping = true;
        u8g2.setPowerSave(1);
        for (int r = 0; r < GRID_ROWS; r++)
            for (int c = 0; c < GRID_COLS; c++)
                strip.SetPixelColor(grid_to_led(r, c), RgbColor(0, 0, 0));
        strip.Show();
    }
}

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("Boot");

    nvs_flash_init();
    load_grid_nvs();
    load_settings_nvs();
    Serial.println("NVS loaded");

    Wire.begin(OLED_SDA, OLED_SCL);
    Wire.setClock(400000);

    Serial.print("I2C scan: ");
    for (uint8_t addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        if (Wire.endTransmission() == 0) {
            Serial.printf("0x%02X ", addr);
        }
    }
    Serial.println();

    oled_setup();
    Serial.println("OLED ready");

    led_setup();
    Serial.println("LED ready");

    buttons_setup();
    update_oled();

    delay(100);
    setup_ble();
    if (!settings.bleOn) {
        NimBLEDevice::stopAdvertising();
        Serial.println("BLE off (setting)");
    }
    Serial.println("Ready");
    lastActivityMs = millis();
    lastLedActivityMs = millis();
}

void loop() {
    if (bleRestartAdv) {
        bleRestartAdv = false;
        NimBLEDevice::startAdvertising();
        Serial.println("BLE advertising restarted");
    }
    handle_btns();
    read_serial();
    check_conn_timeout();
    check_screen_timeout();
    update_leds_anim();
    delay(1);
}
