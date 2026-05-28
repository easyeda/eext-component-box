# Hardware — 智能器件盒固件

ESP32-S3 驱动的智能器件盒硬件固件，配合 eext-component-box 扩展实现器件的物理存储与数字化管理。

## 硬件平台

| 项目 | 规格 |
|------|------|
| 主控 | LCKFB ESP32S3R8N8 |
| 框架 | Arduino |
| 构建系统 | PlatformIO |
| LED | WS2812B x 35 (5x7 格栅) |
| 显示 | 128x64 SSD1306 OLED (I2C) |
| 输入 | 5 向方向键 (D-Pad) |
| 通信 | USB Serial / Bluetooth LE |

## 引脚定义

| 功能 | GPIO |
|------|------|
| LED 数据 | 48 |
| OLED SDA | 40 |
| OLED SCL | 39 |
| 方向键-上 | 46 |
| 方向键-下 | 15 |
| 方向键-左 | 41 |
| 方向键-右 | 45 |
| 方向键-确认 | 42 |

## 依赖库

| 库 | 版本 | 用途 |
|----|------|------|
| U8g2 | 2.36.18 | OLED 显示驱动 |
| NeoPixelBus | 2.8.1 | WS2812B LED 控制 |
| ArduinoJson | 7.2.1 | JSON 通信协议 |
| NimBLE-Arduino | 2.3.0 | 蓝牙 BLE 连接 |

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

## 功能说明

### 通信接口

- **USB 串口**：115200 波特率，逐行 JSON 文本协议
- **蓝牙 BLE**：自定义 Service (0xFFE0)，TX (0xFFE1) / RX (0xFFE2) 特征值
- 设备名称：`ESP-ComponentBox`
- 支持自动重连与广播管理，3 秒连接超时检测

### 按键导航

- 5 向 D-Pad 方向键
- 确认键：
  - 短按：当前格位器件数量减一（取料）
  - 长按（500ms）：进入/退出设置菜单

### 设置系统

11 项可配置参数，中英文双语：

| 设置项 | 选项 |
|--------|------|
| 灯光颜色 | 红/绿/蓝/黄/紫/白/橙 |
| 灯光亮度 | 10% ~ 100%（10 级） |
| 空闲灯效 | 关闭/彩虹/波涛/呼吸/渐变 |
| 空闲时间 | 3s / 5s / 10s / 15s / 30s / 60s |
| 光标灯效 | 静态/闪烁/呼吸/渐变 |
| 屏幕对比度 | 50 ~ 255 |
| 熄屏倒计时 | 永不 / 1~30 分钟 |
| 蓝牙开关 | 开启 / 关闭 |
| 语言切换 | 中文 / English |
| 重新配对 | 清除 BLE 配对信息 |
| 退出设置 | 返回普通模式 |

所有设置通过 NVS 持久化保存。

### 通信协议

基于 JSON 的双向消息协议，每条消息以换行符分隔：

**软件 → 硬件：**

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

**硬件 → 软件：**

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
