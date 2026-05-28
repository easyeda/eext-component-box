#pragma once
#include "config.h"
#include <NeoPixelBus.h>

extern NeoPixelBus<NeoGrbFeature, NeoWs2812xMethod> strip;
extern unsigned long lastLedActivityMs;

void led_setup();
RgbColor hsvToRgb(uint8_t h, uint8_t s, uint8_t v);
RgbColor applyBrightness(uint8_t r, uint8_t g, uint8_t b);
RgbColor getCursorColor();
void update_leds_now();
void update_leds_anim();
