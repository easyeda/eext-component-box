#include "ble.h"
#include "config.h"
#include "comm.h"
#include "oled.h"
#include "settings.h"
#include <NimBLEDevice.h>

static NimBLEServer *bleServer = nullptr;
static NimBLECharacteristic *charTx = nullptr;
static NimBLECharacteristic *charRx = nullptr;
static bool bleConnected = false;
bool bleRestartAdv = false;

static char ble_rbuf[512];
static int ble_rpos = 0;

void ble_send_json(JsonDocument &doc) {
    if (!bleConnected || !charTx) return;
    char buf[256];
    size_t len = serializeJson(doc, buf, sizeof(buf) - 1);
    buf[len] = '\n';
    len++;
    charTx->setValue((uint8_t *)buf, len);
    charTx->notify();
}

void on_rx(const char *s); // from message.h/.cpp

class ServerCallbacks : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer *server, NimBLEConnInfo &connInfo) override {
        bleConnected = true;
        connType = 'B';
        lastConnMs = millis();
        server->setDataLen(connInfo.getConnHandle(), 256);
        Serial.println("BLE connected");
        if (appMode == MODE_NORMAL) update_oled();
    }
    void onDisconnect(NimBLEServer *server, NimBLEConnInfo &connInfo, int reason) override {
        bleConnected = false;
        connType = 0;
        lastConnMs = 0;
        Serial.println("BLE disconnected");
        bleRestartAdv = true;
        if (appMode == MODE_NORMAL) update_oled();
    }
};

class RxCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic *ch, NimBLEConnInfo &connInfo) override {
        std::string val = ch->getValue();
        lastConnMs = millis();
        for (size_t i = 0; i < val.size(); i++) {
            char c = val[i];
            if (c == '\n' || c == '\r') {
                if (ble_rpos > 0) { ble_rbuf[ble_rpos] = 0; on_rx(ble_rbuf); ble_rpos = 0; }
            } else if (ble_rpos < (int)sizeof(ble_rbuf) - 1) {
                ble_rbuf[ble_rpos++] = c;
            }
        }
    }
};

void setup_ble() {
    NimBLEDevice::init("ESP-ComponentBox");
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);

    bleServer = NimBLEDevice::createServer();
    bleServer->setCallbacks(new ServerCallbacks());

    NimBLEService *svc = bleServer->createService(BLE_SERVICE_UUID);

    charTx = svc->createCharacteristic(
        BLE_CHAR_TX_UUID,
        NIMBLE_PROPERTY::NOTIFY | NIMBLE_PROPERTY::READ
    );

    charRx = svc->createCharacteristic(
        BLE_CHAR_RX_UUID,
        NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
    );
    charRx->setCallbacks(new RxCallbacks());

    NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();
    adv->setName("ESP-ComponentBox");
    adv->addServiceUUID(BLE_SERVICE_UUID);
    adv->enableScanResponse(true);
    adv->setMinInterval(0x20);
    adv->setMaxInterval(0x40);
    NimBLEDevice::startAdvertising();
    Serial.println("BLE advertising");
}
