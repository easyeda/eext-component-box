#pragma once
#include <U8g2lib.h>

extern U8G2_SSD1306_128X64_NONAME_F_SW_I2C u8g2;

void oled_setup();
void update_oled();
void update_oled_settings();
void oled_draw_text(const char *l1, const char *l2, const char *l3);
