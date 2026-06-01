# Hardware — Smart Component Box Firmware

![alt text](../images/123.jpg)

ESP32-S3 driven smart component box firmware, working with the eext-component-box extension to enable physical storage and digital management of components.

## Hardware Overview

| Module | Specification | Description |
|--------|---------------|-------------|
| MCU | LCKFB ESP32S3R8N8 | Dual-core Xtensa LX7, 240MHz |
| LED Array | WS2812B-MINI-V3J x35 | 5x7 grid, full-color RGB |
| OLED Display | HS96L03W2C03 | 128x64 SSD1306, I2C |
| Power Management | IP5306 + USB-C | Lithium battery charge/discharge management |

## Source Code Structure

```
src/
├── main.cpp          # Entry point, module initialization and main loop
├── config.h          # Global configuration (pins, grid size, communication params)
├── ble.h / ble.cpp   # Bluetooth BLE connection management and data transfer
├── buttons.h / .cpp  # 5-way button detection, debounce, long/short press recognition
├── comm.h / comm.cpp # Communication protocol layer, unified Serial/BLE message handling
├── grid.h / grid.cpp # 5x7 component grid data management and NVS persistence
├── led.h / led.cpp   # WS2812B LED control and lighting effects
├── message.h / .cpp  # JSON message parsing and business logic handling
├── oled.h / oled.cpp # OLED display management (normal/settings/status modes)
└── settings.h / .cpp # Hardware settings menu and NVS configuration storage
```

## Communication Interfaces

- **USB Serial**: 115200 baud rate, line-by-line JSON text protocol
- **Bluetooth BLE**: Custom Service (0xFFE0), TX (0xFFE1) / RX (0xFFE2) characteristics
- Device name: `ESP-ComponentBox`
- Auto-reconnect and broadcast management, 3-second connection timeout detection

## Communication Protocol

JSON-based bidirectional message protocol, each message delimited by a newline:

### Software → Hardware

| type | Description | Fields |
|------|-------------|--------|
| `info` | Write component info | row, col, name, qty, lcscId |
| `clear` | Clear slot | row, col |
| `goto` | Move cursor | row, col |
| `dec` | Decrement quantity | — |
| `sync` | Sync slot | row, col, name, qty, lcscId |
| `getcursor` | Query cursor position | — |
| `showinfo` | Show component info | name, qty, lcscId |
| `shownotfound` | Show not found | — |
| `stoggle` | Toggle settings mode | — |
| `snav` | Settings navigation | dir: "up"/"down"/"ok" |

### Hardware → Software

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

2. Compile firmware

    ```shell
    cd Hardware
    pio run
    ```

3. Flash to ESP32-S3

    ```shell
    pio run --target upload
    ```

4. View serial log

    ```shell
    pio device monitor
    ```

> **Notes**
> - If the first flash attempt fails, hold the BOOT button and press RESET to enter download mode
> - Set serial monitor baud rate to 115200
> - Bluetooth device name is `ESP-ComponentBox`, BLE Service UUID: `0xFFE0`
> - Data is persisted via NVS, survives power cycles and reboots

### Flashing Compiled Binaries

If you compile from source, the build directory will produce three bin files: `bootloader.bin`, `partitions.bin`, and `firmware.bin`. When flashing manually, use the partition addresses provided in the table below:

| Binary | Flash Address |
|--------|---------------|
| bootloader.bin | 0x00000000 |
| partitions.bin | 0x00008000 |
| boot_app0.bin | 0xe000 |
| firmware.bin | 0x00010000 |
