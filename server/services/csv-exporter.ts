import { storage } from '../storage.js';

export interface RoomExportData {
  room: {
    id: string;
    name: string;
    description?: string | null;
    createdAt: Date;
  };
  boxes: {
    id: string;
    label: string;
    notes?: string | null;
    createdAt: Date;
  }[];
  items: {
    id: string;
    boxId: string;
    boxLabel: string;
    name: string;
    description?: string | null;
    quantity: number;
    createdAt: Date;
  }[];
}

class CSVExporterService {
  async exportRoomData(roomId: string): Promise<{ roomCsv: string; boxesCsv: string; itemsCsv: string }> {
    try {
      // Get room data
      const room = await storage.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      // Get boxes data
      const boxes = await storage.getBoxesByRoom(roomId);
      
      // Get all items for all boxes in the room
      const allItems = [];
      for (const box of boxes) {
        const items = await storage.getItemsByBox(box.id);
        for (const item of items) {
          allItems.push({
            ...item,
            boxLabel: box.label
          });
        }
      }

      // Generate CSV data
      const roomCsv = this.generateRoomCsv(room);
      const boxesCsv = this.generateBoxesCsv(boxes);
      const itemsCsv = this.generateItemsCsv(allItems);

      return { roomCsv, boxesCsv, itemsCsv };
    } catch (error) {
      console.error('Failed to export room data:', error);
      throw error;
    }
  }

  private generateRoomCsv(room: any): string {
    const headers = ['ID', 'Name', 'Description', 'Created At'];
    const row = [
      this.escapeCsvValue(room.id),
      this.escapeCsvValue(room.name),
      this.escapeCsvValue(room.description || ''),
      this.escapeCsvValue(room.createdAt?.toISOString() || '')
    ];

    return [headers.join(','), row.join(',')].join('\n');
  }

  private generateBoxesCsv(boxes: any[]): string {
    const headers = ['ID', 'Label', 'Notes', 'Item Count', 'Created At'];
    const rows = boxes.map(box => [
      this.escapeCsvValue(box.id),
      this.escapeCsvValue(box.label),
      this.escapeCsvValue(box.notes || ''),
      this.escapeCsvValue(box.itemCount?.toString() || '0'),
      this.escapeCsvValue(box.createdAt?.toISOString() || '')
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private generateItemsCsv(items: any[]): string {
    const headers = ['ID', 'Box ID', 'Box Label', 'Name', 'Description', 'Quantity', 'Created At'];
    const rows = items.map(item => [
      this.escapeCsvValue(item.id),
      this.escapeCsvValue(item.boxId),
      this.escapeCsvValue(item.boxLabel),
      this.escapeCsvValue(item.name),
      this.escapeCsvValue(item.description || ''),
      this.escapeCsvValue(item.quantity?.toString() || '1'),
      this.escapeCsvValue(item.createdAt?.toISOString() || '')
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  async generateCombinedCsv(roomId: string): Promise<string> {
    try {
      const room = await storage.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const boxes = await storage.getBoxesByRoom(roomId);
      
      // Create combined data with all information
      const combinedData = [];
      
      for (const box of boxes) {
        const items = await storage.getItemsByBox(box.id);
        
        if (items.length === 0) {
          // Box with no items
          combinedData.push({
            roomName: room.name,
            roomDescription: room.description || '',
            boxLabel: box.label,
            boxNotes: box.notes || '',
            itemName: '',
            itemDescription: '',
            itemQuantity: '',
            createdAt: box.createdAt?.toISOString() || ''
          });
        } else {
          // Box with items
          for (const item of items) {
            combinedData.push({
              roomName: room.name,
              roomDescription: room.description || '',
              boxLabel: box.label,
              boxNotes: box.notes || '',
              itemName: item.name,
              itemDescription: item.description || '',
              itemQuantity: item.quantity?.toString() || '1',
              createdAt: item.createdAt?.toISOString() || ''
            });
          }
        }
      }

      // Generate CSV
      const headers = [
        'Room Name', 'Room Description', 'Box Label', 'Box Notes', 
        'Item Name', 'Item Description', 'Item Quantity', 'Created At'
      ];
      
      const rows = combinedData.map(row => [
        this.escapeCsvValue(row.roomName),
        this.escapeCsvValue(row.roomDescription),
        this.escapeCsvValue(row.boxLabel),
        this.escapeCsvValue(row.boxNotes),
        this.escapeCsvValue(row.itemName),
        this.escapeCsvValue(row.itemDescription),
        this.escapeCsvValue(row.itemQuantity),
        this.escapeCsvValue(row.createdAt)
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    } catch (error) {
      console.error('Failed to generate combined CSV:', error);
      throw error;
    }
  }

  private escapeCsvValue(value: string): string {
    if (!value) return '';
    
    // Escape quotes and wrap in quotes if needed
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    
    return value;
  }
}

export const csvExporterService = new CSVExporterService();