# Hardware — Smart Component Box Firmware

ESP32-S3 powered smart component box firmware, working with the eext-component-box extension for physical component storage and digital management.

## Hardware Platform

| Item | Spec |
|------|------|
| MCU | LCKFB ESP32S3R8N8 |
| Framework | Arduino |
| Build System | PlatformIO |
| LED | WS2812B x 35 (5x7 grid) |
| Display | 128x64 SSD1306 OLED (I2C) |
| Input | 5-way D-pad |
| Communication | USB Serial / Bluetooth LE |

## Pin Definitions

| Function | GPIO |
|----------|------|
| LED Data | 48 |
| OLED SDA | 40 |
| OLED SCL | 39 |
| D-Pad Up | 46 |
| D-Pad Down | 15 |
| D-Pad Left | 41 |
| D-Pad Right | 45 |
| D-Pad Center | 42 |

## Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| U8g2 | 2.36.18 | OLED display driver |
| NeoPixelBus | 2.8.1 | WS2812B LED control |
| ArduinoJson | 7.2.1 | JSON communication protocol |
| NimBLE-Arduino | 2.3.0 | Bluetooth LE connectivity |

## Source Structure

```
src/
├── main.cpp          # Entry point, module initialization and main loop
├── config.h          # Global config (pins, grid size, comm parameters)
├── ble.h / ble.cpp   # BLE connection management and data I/O
├── buttons.h / .cpp  # 5-way button detection, debounce, long/short press
├── comm.h / comm.cpp # Communication protocol layer, unified Serial/BLE messaging
├── grid.h / grid.cpp # 5x7 component grid data management and NVS persistence
├── led.h / led.cpp   # WS2812B LED control and lighting effects
├── message.h / .cpp  # JSON message parsing and business logic
├── oled.h / oled.cpp # OLED display management (normal/settings/status modes)
└── settings.h / .cpp # Hardware settings menu and NVS config storage
```

## Features

### Communication Interfaces

- **USB Serial**: 115200 baud, line-based JSON text protocol
- **Bluetooth LE**: Custom Service (0xFFE0), TX (0xFFE1) / RX (0xFFE2) characteristics
- Device name: `ESP-ComponentBox`
- Auto-reconnect and advertising management, 3-second connection timeout detection

### Button Navigation

- 5-way D-pad
- Center button:
  - Short press: Decrement current slot quantity (pick component)
  - Long press (500ms): Enter/exit settings menu

### Settings System

11 configurable parameters, bilingual (Chinese/English):

| Setting | Options |
|---------|---------|
| LED Color | Red / Green / Blue / Yellow / Purple / White / Orange |
| Brightness | 10% ~ 100% (10 levels) |
| Idle Effect | Off / Rainbow / Wave / Breathing / Gradient |
| Idle Time | 3s / 5s / 10s / 15s / 30s / 60s |
| Cursor Effect | Static / Blink / Breathing / Gradient |
| Screen Contrast | 50 ~ 255 |
| Sleep Timer | Never / 1~30 min |
| Bluetooth | On / Off |
| Language | Chinese / English |
| Re-pair | Clear BLE pairing info |
| Exit Settings | Return to normal mode |

All settings persist via NVS.

### Communication Protocol

JSON-based bidirectional messaging, one message per line:

**Software → Hardware:**

| type | Description | Fields |
|------|-------------|--------|
| `info` | Write component info | row, col, name, qty, lcscId |
| `clear` | Clear slot | row, col |
| `goto` | Move cursor | row, col |
| `dec` | Decrement quantity | — |
| `sync` | Sync slot | row, col, name, qty, lcscId |
| `getcursor` | Query cursor position | — |
| `showinfo` | Display component info | name, qty, lcscId |
| `shownotfound` | Display not found | — |
| `stoggle` | Toggle settings mode | — |
| `snav` | Settings navigation | dir: "up"/"down"/"ok" |

**Hardware → Software:**

| type | Description | Fields |
|------|-------------|--------|
| `cursor` | Cursor position | row, col |
| `oled` | OLED display content | l1, l2, l3 |
| `mode` | Mode switch | mode: "normal"/"settings" |
| `settings` | Settings state | colorIdx, brightIdx, ... |
| `qtyreport` | Quantity report | row, col, qty |
| `synccomplete` | Sync complete | — |

## Build & Flash

1. Install [PlatformIO](https://platformio.org/)

2. Build firmware

    ```shell
    cd Hardware
    pio run
    ```

3. Flash to ESP32-S3

    ```shell
    pio run --target upload
    ```

4. Monitor serial output

    ```shell
    pio device monitor
    ```
