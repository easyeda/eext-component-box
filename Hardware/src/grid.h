#pragma once
#include "config.h"
#include <stdint.h>

struct Cell {
    char name[64] = {};
    int qty = 0;
    char id[16] = {};
    bool valid = false;
};

struct Led { uint8_t r = 0, g = 0, b = 0; bool on = false; };

extern Cell grid[GRID_ROWS][GRID_COLS];
extern Led leds[GRID_ROWS][GRID_COLS];
extern int cur_r, cur_c;

int grid_to_led(int row, int col);
void save_grid_nvs();
void load_grid_nvs();
