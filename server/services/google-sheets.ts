import { google } from 'googleapis';
import { googleAuthClient } from './google-auth.js';

const sheets = google.sheets({ version: 'v4', auth: googleAuthClient });

export interface SheetRow {
  [key: string]: string | number | null;
}

class GoogleSheetsService {
  private spreadsheetId: string;

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.INVENTORY_SPREADSHEET_ID || "default_spreadsheet_id";
  }

  async createSpreadsheet(title: string): Promise<string> {
    try {
      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title,
          },
          sheets: [
            { properties: { title: 'Rooms' } },
            { properties: { title: 'Boxes' } },
            { properties: { title: 'Items' } },
            { properties: { title: 'ItemPhotos' } },
            { properties: { title: 'Memberships' } },
            { properties: { title: 'PullSheets' } },
          ],
        },
      });

      const spreadsheetId = response.data.spreadsheetId!;
      this.spreadsheetId = spreadsheetId;
      
      // Initialize headers for each sheet
      await this.initializeSheetHeaders();
      
      return spreadsheetId;
    } catch (error) {
      console.error('Failed to create spreadsheet:', error);
      throw error;
    }
  }

  private async initializeSheetHeaders() {
    const headers = {
      Rooms: ['room_id', 'room_name', 'description', 'created_at', 'created_by', 'drive_folder'],
      Boxes: ['box_id', 'room_id', 'box_label', 'notes', 'created_at', 'drive_folder', 'qr_code'],
      Items: ['item_id', 'box_id', 'name', 'description', 'qty', 'primary_photo_file_id', 'created_at'],
      ItemPhotos: ['item_photo_id', 'item_id', 'drive_file_id', 'web_view_link', 'thumb_link', 'created_at'],
      Memberships: ['membership_id', 'room_id', 'user_id', 'role', 'created_at'],
      PullSheets: ['pull_sheet_id', 'box_id', 'qr_image_drive_file_id', 'last_generated_at'],
    };

    for (const [sheetName, headerRow] of Object.entries(headers)) {
      await this.appendRows(sheetName, [headerRow]);
    }
  }

  async getRows(sheetName: string, range?: string): Promise<string[][]> {
    try {
      const fullRange = range ? `${sheetName}!${range}` : sheetName;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: fullRange,
      });

      return response.data.values || [];
    } catch (error) {
      console.error(`Failed to get rows from ${sheetName}:`, error);
      throw error;
    }
  }

  async appendRows(sheetName: string, rows: (string | number | null)[][]): Promise<void> {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: sheetName,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: rows,
        },
      });
    } catch (error) {
      console.error(`Failed to append rows to ${sheetName}:`, error);
      throw error;
    }
  }

  async updateRows(sheetName: string, range: string, rows: (string | number | null)[][]): Promise<void> {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: rows,
        },
      });
    } catch (error) {
      console.error(`Failed to update rows in ${sheetName}:`, error);
      throw error;
    }
  }

  async batchUpdate(requests: any[]): Promise<void> {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests,
        },
      });
    } catch (error) {
      console.error('Failed to batch update spreadsheet:', error);
      throw error;
    }
  }

  async findRowByValue(sheetName: string, columnIndex: number, value: string): Promise<number | null> {
    try {
      const rows = await this.getRows(sheetName);
      
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][columnIndex] === value) {
          return i + 1; // Sheets are 1-indexed
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to find row in ${sheetName}:`, error);
      throw error;
    }
  }
}

export const googleSheetsService = new GoogleSheetsService();
