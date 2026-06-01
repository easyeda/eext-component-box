# Hardware — 智能器件盒固件

![alt text](../images/123.jpg)

ESP32-S3 驱动的智能器件盒硬件固件，配合 eext-component-box 扩展实现器件的物理存储与数字化管理。

## 硬件组成概览

| 模块 | 规格 | 说明 |
|------|------|------|
| 主控模块 | LCKFB ESP32S3R8N8 | 双核 Xtensa LX7，240MHz |
| LED阵列 | WS2812B-MINI-V3J x35 | 5x7 格栅，RGB全彩 |
| OLED屏幕 | HS96L03W2C03 | 128x64 SSD1306，I2C |
| 电源管理 | IP5306 + USB-C | 锂电充放电管理 |


## 源码结构

```
src/
├── main.cpp          # 程序入口，初始化各模块与主循环
├── config.h          # 全局配置（引脚、格栅尺寸、通信参数）
├── ble.h / ble.cpp   # 蓝牙 BLE 连接管理与数据收发
├── buttons.h / .cpp  # 5 向按键检测、消抖、长短按识别
├── comm.h / comm.cpp # 通信协议层，统一 Serial/BLE 消息收发
├── grid.h / grid.cpp # 5x7 器件格栅数据管理与 NVS 持久化
├── led.h / led.cpp   # WS2812B LED 控制与灯效动画
├── message.h / .cpp  # JSON 消息解析与业务逻辑处理
├── oled.h / oled.cpp # OLED 显示管理（普通/设置/状态模式）
└── settings.h / .cpp # 硬件设置菜单与 NVS 配置存储
```

## 通信接口

- **USB 串口**：115200 波特率，逐行 JSON 文本协议
- **蓝牙 BLE**：自定义 Service (0xFFE0)，TX (0xFFE1) / RX (0xFFE2) 特征值
- 设备名称：`ESP-ComponentBox`
- 支持自动重连与广播管理，3 秒连接超时检测


## 通信协议

基于 JSON 的双向消息协议，每条消息以换行符分隔：

### 软件 → 硬件

| type | 说明 | 字段 |
|------|------|------|
| `info` | 写入器件信息 | row, col, name, qty, lcscId |
| `clear` | 清除格位 | row, col |
| `goto` | 移动光标 | row, col |
| `dec` | 数量减一 | — |
| `sync` | 同步格位 | row, col, name, qty, lcscId |
| `getcursor` | 查询光标位置 | — |
| `showinfo` | 显示器件信息 | name, qty, lcscId |
| `shownotfound` | 显示未找到 | — |
| `stoggle` | 切换设置模式 | — |
| `snav` | 设置导航 | dir: "up"/"down"/"ok" |

### 硬件 → 软件

| type | 说明 | 字段 |
|------|------|------|
| `cursor` | 光标位置 | row, col |
| `oled` | OLED 显示内容 | l1, l2, l3 |
| `mode` | 模式切换 | mode: "normal"/"settings" |
| `settings` | 设置状态 | colorIdx, brightIdx, ... |
| `qtyreport` | 数量上报 | row, col, qty |
| `synccomplete` | 同步完成 | — |


## 构建与烧录

1. 安装 [PlatformIO](https://platformio.org/)

2. 编译固件

    ```shell
    cd Hardware
    pio run
    ```

3. 烧录到 ESP32-S3

    ```shell
    pio run --target upload
    ```

4. 查看串口日志

    ```shell
    pio device monitor
    ```

> **注意事项**
> - 首次烧录失败时，按住 BOOT 键再按 RESET 进入下载模式
> - 串口监视器波特率设置为 115200
> - 蓝牙设备名称为 `ESP-ComponentBox`，BLE Service UUID: `0xFFE0`
> - 数据通过 NVS 持久化存储，断电重启不会丢失

### 编译后产物烧录

如果你通过源码编译，则会在build目录下产生 `bootloader.bin` `partitions.bin` `firmware.bin` 这三个bin文件，所以在烧录时请按照下表提供的分区地址烧录：

| 产物名 | 烧录地址 |
|--------|----------|
| bootloader.bin | 0x00000000 |
| partitions.bin | 0x00008000 |
| boot_app0.bin | 0xe000 |
| firmware.bin | 0x00010000 |
