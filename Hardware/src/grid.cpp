#include "grid.h"
#include <Arduino.h>
#include <nvs_flash.h>
#include <nvs.h>

Cell grid[GRID_ROWS][GRID_COLS];
Led leds[GRID_ROWS][GRID_COLS];
int cur_r = 0, cur_c = 0;

int grid_to_led(int row, int col) {
    int r = GRID_ROWS - 1 - row;
    return (r % 2 == 0) ? r * GRID_COLS + col : r * GRID_COLS + (GRID_COLS - 1 - col);
}

void save_grid_nvs() {
    nvs_handle_t h;
    if (nvs_open("box", NVS_READWRITE, &h) != ESP_OK) return;
    for (int r = 0; r < GRID_ROWS; r++)
        for (int c = 0; c < GRID_COLS; c++) {
            char key[8];
            snprintf(key, sizeof(key), "c%01d%01d", r, c);
            if (grid[r][c].valid) {
                char val[96];
                snprintf(val, sizeof(val), "%s|%d|%s", grid[r][c].name, grid[r][c].qty, grid[r][c].id);
                nvs_set_str(h, key, val);
            } else {
                nvs_erase_key(h, key);
            }
        }
    nvs_commit(h);
    nvs_close(h);
}

void load_grid_nvs() {
    nvs_handle_t h;
    if (nvs_open("box", NVS_READONLY, &h) != ESP_OK) return;
    for (int r = 0; r < GRID_ROWS; r++)
        for (int c = 0; c < GRID_COLS; c++) {
            char key[8];
            snprintf(key, sizeof(key), "c%01d%01d", r, c);
            char val[96] = {};
            size_t len = sizeof(val);
            if (nvs_get_str(h, key, val, &len) == ESP_OK) {
                char *p1 = strchr(val, '|');
                if (!p1) continue;
                *p1 = 0; p1++;
                char *p2 = strchr(p1, '|');
                if (!p2) continue;
                *p2 = 0; p2++;
                strlcpy(grid[r][c].name, val, sizeof(grid[r][c].name));
                grid[r][c].qty = atoi(p1);
                strlcpy(grid[r][c].id, p2, sizeof(grid[r][c].id));
                grid[r][c].valid = true;
            }
        }
    nvs_close(h);
}
