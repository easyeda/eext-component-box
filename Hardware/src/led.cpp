#include "led.h"
#include "grid.h"
#include "settings.h"
#include <math.h>

NeoPixelBus<NeoGrbFeature, NeoWs2812xMethod> strip(LED_COUNT, LED_GPIO);
unsigned long lastLedActivityMs = 0;

static unsigned long lastLedTick = 0;
static uint16_t animFrame = 0;

void led_setup() {
    strip.Begin();
    strip.Show();
    lastLedActivityMs = millis();
    lastLedTick = millis();
}

RgbColor hsvToRgb(uint8_t h, uint8_t s, uint8_t v) {
    float hh = h / 255.0f * 6.0f;
    float ss = s / 255.0f;
    float vv = v / 255.0f;
    int i = (int)hh;
    float f = hh - i;
    float p = vv * (1.0f - ss);
    float q = vv * (1.0f - ss * f);
    float t = vv * (1.0f - ss * (1.0f - f));
    float r, g, b;
    switch (i % 6) {
        case 0: r = vv; g = t; b = p; break;
        case 1: r = q; g = vv; b = p; break;
        case 2: r = p; g = vv; b = t; break;
        case 3: r = p; g = q; b = vv; break;
        case 4: r = t; g = p; b = vv; break;
        default: r = vv; g = p; b = q; break;
    }
    return RgbColor((uint8_t)(r * 255), (uint8_t)(g * 255), (uint8_t)(b * 255));
}

RgbColor applyBrightness(uint8_t r, uint8_t g, uint8_t b) {
    float scale = (float)settings.brightIdx / 10.0f;
    return RgbColor((uint8_t)(r * scale), (uint8_t)(g * scale), (uint8_t)(b * scale));
}

static RgbColor getIdleColor(int pos) {
    float scale = (float)settings.brightIdx / 10.0f;
    switch (settings.idleEffect) {
        case 0: return RgbColor(0, 0, 0);
        case 1: {
            uint8_t hue = (uint8_t)((animFrame + pos * 8) & 0xFF);
            return hsvToRgb(hue, 255, (uint8_t)(255 * scale));
        }
        case 2: {
            float wave = sinf(animFrame * 0.05f + pos * 0.4f) * 0.5f + 0.5f;
            uint8_t v = (uint8_t)(255 * wave * scale);
            return RgbColor(v, v * 0.6f, v * 0.2f);
        }
        case 3: {
            float breath = sinf(animFrame * 0.03f) * 0.5f + 0.5f;
            uint8_t cr = colorPresets[settings.colorIdx][0];
            uint8_t cg = colorPresets[settings.colorIdx][1];
            uint8_t cb = colorPresets[settings.colorIdx][2];
            return RgbColor((uint8_t)(cr * breath * scale),
                           (uint8_t)(cg * breath * scale),
                           (uint8_t)(cb * breath * scale));
        }
        case 4: {
            uint8_t hue = (uint8_t)((animFrame * 2 + pos * 6) & 0xFF);
            return hsvToRgb(hue, 200, (uint8_t)(255 * scale));
        }
    }
    return RgbColor(0, 0, 0);
}

RgbColor getCursorColor() {
    float scale = (float)settings.brightIdx / 10.0f;
    uint8_t cr = colorPresets[settings.colorIdx][0];
    uint8_t cg = colorPresets[settings.colorIdx][1];
    uint8_t cb = colorPresets[settings.colorIdx][2];

    switch (settings.cursorEffect) {
        case 0: return applyBrightness(cr, cg, cb);
        case 1: {
            if ((animFrame / 15) % 2 == 0) return applyBrightness(cr, cg, cb);
            return RgbColor(0, 0, 0);
        }
        case 2: {
            float breath = sinf(animFrame * 0.05f) * 0.5f + 0.5f;
            return RgbColor((uint8_t)(cr * breath * scale),
                           (uint8_t)(cg * breath * scale),
                           (uint8_t)(cb * breath * scale));
        }
        case 3: {
            uint8_t hue = (uint8_t)((animFrame * 3) & 0xFF);
            return hsvToRgb(hue, 255, (uint8_t)(255 * scale));
        }
    }
    return applyBrightness(cr, cg, cb);
}

void update_leds_now() {
    for (int r = 0; r < GRID_ROWS; r++)
        for (int c = 0; c < GRID_COLS; c++) {
            int i = grid_to_led(r, c);
            if (r == cur_r && c == cur_c) {
                strip.SetPixelColor(i, getCursorColor());
            } else if (leds[r][c].on) {
                strip.SetPixelColor(i, applyBrightness(leds[r][c].r, leds[r][c].g, leds[r][c].b));
            } else {
                strip.SetPixelColor(i, RgbColor(0, 0, 0));
            }
        }
    strip.Show();
}

void update_leds_anim() {
    if (screenSleeping) return;
    unsigned long now = millis();
    if (now - lastLedTick < LED_ANIM_MS) return;
    lastLedTick = now;
    animFrame++;

    bool isIdle = (settings.idleEffect > 0) &&
                  (appMode == MODE_NORMAL) &&
                  (now - lastLedActivityMs > (unsigned long)idleTimeouts[settings.idleTimeoutIdx] * 1000UL);

    if (isIdle) {
        int pos = 0;
        for (int r = 0; r < GRID_ROWS; r++)
            for (int c = 0; c < GRID_COLS; c++) {
                int i = grid_to_led(r, c);
                if (r == cur_r && c == cur_c) {
                    strip.SetPixelColor(i, getCursorColor());
                } else {
                    strip.SetPixelColor(i, getIdleColor(pos));
                }
                pos++;
            }
    } else {
        for (int r = 0; r < GRID_ROWS; r++)
            for (int c = 0; c < GRID_COLS; c++) {
                int i = grid_to_led(r, c);
                if (r == cur_r && c == cur_c) {
                    strip.SetPixelColor(i, getCursorColor());
                } else if (leds[r][c].on) {
                    strip.SetPixelColor(i, applyBrightness(leds[r][c].r, leds[r][c].g, leds[r][c].b));
                } else {
                    strip.SetPixelColor(i, RgbColor(0, 0, 0));
                }
            }
    }
    strip.Show();
}
