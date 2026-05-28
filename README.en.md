[简体中文](./README.md) | [English](#)

# eext-component-box

Smart Component Box Manager — A easyeda extension for Smart Component Box

## Features

### Personal Component Library

- **Import LCSC Order Sheets**: Import `.xls` / `.xlsx` order files from LCSC, automatically parsing part numbers (C-codes) and quantities
- **Batch Component Lookup**: Query component name, footprint, description, and manufacturer info by LCSC ID in batches
- **Search & Filter**: Real-time search by part number, name, description, or manufacturer
- **Edit & Delete**: Edit component properties (name, footprint, quantity, etc.) or batch select for deletion
- **One-Click Placement**: Place components directly into schematic or PCB editors, with automatic inventory deduction

| Component Library | Component Box |
| --- | --- |
| ![Component Library](images/image1.png) | ![Component Box](images/image2.png) |

### Component Box Management

[Hardware](Hardware/README.md)
- **5x7 Grid Layout**: Software UI mirrors the physical 5-row x 7-column component box layout, each slot mappable to a component
- **Double-Click Assignment**: Double-click a slot to open the component picker and assign a component from the library
- **Component Info Display**: View component name, part number, and stock quantity
- **Real-Time Sync**: Software-side emulation of hardware OLED screen and five buttons, with real-time bidirectional synchronization
