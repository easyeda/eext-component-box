#include "oled.h"
#include "config.h"
#include "grid.h"
#include "settings.h"
#include "comm.h"

U8G2_SSD1306_128X64_NONAME_F_SW_I2C u8g2(U8G2_R0, OLED_SCL, OLED_SDA, U8X8_PIN_NONE);

void oled_setup() {
    u8g2.begin();
    u8g2.setContrast(settings.contrast);
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
    u8g2.drawUTF8(0, 30, langStr("器件盒启动...", "Box starting..."));
    u8g2.sendBuffer();
}

void update_oled() {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
    Cell &cl = grid[cur_r][cur_c];
    char ml1[64] = {}, ml2[64] = {}, ml3[64] = {};
    if (cl.valid) {
        u8g2.drawUTF8(0, 14, cl.name);
        char buf[32]; snprintf(buf, sizeof(buf), langStr("数量: %d", "Qty: %d"), cl.qty);
        u8g2.drawUTF8(0, 34, buf);
        u8g2.drawUTF8(0, 54, cl.id);
        strlcpy(ml1, cl.name, sizeof(ml1));
        strlcpy(ml2, buf, sizeof(ml2));
        strlcpy(ml3, cl.id, sizeof(ml3));
    } else {
        u8g2.drawUTF8(0, 14, langStr("(空)", "(Empty)"));
        char buf[32]; snprintf(buf, sizeof(buf), langStr("位置: %d-%d", "Pos: %d-%d"), cur_c + 1, cur_r + 1);
        u8g2.drawUTF8(0, 34, buf);
        strlcpy(ml1, langStr("(空)", "(Empty)"), sizeof(ml1));
        strlcpy(ml2, buf, sizeof(ml2));
    }
    char pos[16]; snprintf(pos, sizeof(pos), "[%d,%d]", cur_c + 1, cur_r + 1);
    u8g2.setFont(u8g2_font_6x10_tr);
    u8g2.drawStr(128 - u8g2.getStrWidth(pos) - 2, 62, pos);
    if (connType) {
        const char *badge = (connType == 'B') ? "BLE" : "USB";
        u8g2.drawStr(128 - u8g2.getStrWidth(badge) - 2, 9, badge);
    }
    send_oled_mirror(ml1, ml2, ml3);
    u8g2.sendBuffer();
}

void update_oled_settings() {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
    char ml1[64] = {}, ml2[64] = {}, ml3[64] = {};

    if (appMode == MODE_SETTINGS_LIST) {
        int start = (settingsCursor / 3) * 3;
        if (start + 3 > SETTINGS_COUNT) start = SETTINGS_COUNT - 3;
        if (start < 0) start = 0;
        for (int i = 0; i < 3 && (start + i) < SETTINGS_COUNT; i++) {
            int idx = start + i;
            char line[32];
            snprintf(line, sizeof(line), "%s%s", idx == settingsCursor ? "> " : "  ", settingsName(idx));
            u8g2.drawUTF8(0, 14 + i * 18, line);
            if (i == 0) strlcpy(ml1, line, sizeof(ml1));
            else if (i == 1) strlcpy(ml2, line, sizeof(ml2));
            else strlcpy(ml3, line, sizeof(ml3));
        }
    } else {
        strlcpy(ml1, settingsName(settingsCursor), sizeof(ml1));
        switch (settingsCursor) {
            case 0: snprintf(ml2, sizeof(ml2), langStr("当前: %s", "Current: %s"), colorName(settings.colorIdx)); break;
            case 1: snprintf(ml2, sizeof(ml2), langStr("亮度: %d%%", "Brightness: %d%%"), settings.brightIdx * 10); break;
            case 2: snprintf(ml2, sizeof(ml2), langStr("当前: %s", "Current: %s"), idleEffectName(settings.idleEffect)); break;
            case 3: snprintf(ml2, sizeof(ml2), langStr("%d秒", "%ds"), idleTimeouts[settings.idleTimeoutIdx]); break;
            case 4: snprintf(ml2, sizeof(ml2), langStr("当前: %s", "Current: %s"), cursorEffectName(settings.cursorEffect)); break;
            case 5: snprintf(ml2, sizeof(ml2), langStr("对比度: %d", "Contrast: %d"), settings.contrast); break;
            case 6:
                if (settings.timeoutIdx == 0) strlcpy(ml2, langStr("永不熄屏", "Always On"), sizeof(ml2));
                else snprintf(ml2, sizeof(ml2), langStr("%d分钟", "%dmin"), timeoutOptions[settings.timeoutIdx]);
                break;
            case 7: snprintf(ml2, sizeof(ml2), langStr("蓝牙: %s", "Bluetooth: %s"), settings.bleOn ? langStr("开启", "On") : langStr("关闭", "Off")); break;
            case 8: snprintf(ml2, sizeof(ml2), langStr("当前: %s", "Current: %s"), settings.lang == 0 ? "中文" : "English"); break;
        }
        strlcpy(ml3, langStr("上下调整 中键确认", "Up/Down  OK"), sizeof(ml3));
        u8g2.drawUTF8(0, 14, ml1);
        u8g2.drawUTF8(0, 34, ml2);
        u8g2.drawUTF8(0, 54, ml3);
    }
    send_oled_mirror(ml1, ml2, ml3);
    u8g2.sendBuffer();
}

void oled_draw_text(const char *l1, const char *l2, const char *l3) {
    u8g2.clearBuffer();
    u8g2.setFont(u8g2_font_wqy12_t_gb2312a);
    if (l1 && l1[0]) u8g2.drawUTF8(0, 14, l1);
    if (l2 && l2[0]) u8g2.drawUTF8(0, 34, l2);
    if (l3 && l3[0]) u8g2.drawUTF8(0, 54, l3);
    send_oled_mirror(l1 ? l1 : "", l2 ? l2 : "", l3 ? l3 : "");
    u8g2.sendBuffer();
}
