import { google } from 'googleapis';
import { getValidGoogleClient } from './google-auth.js';

export interface SheetRow {
  [key: string]: string | number | null;
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitterFactor?: number;
}

class GoogleSheetsService {
  private defaultRetryOptions: RetryOptions = {
    maxRetries: 5,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    jitterFactor: 0.1 // 10% jitter
  };

  private async retryWithExponentialBackoff<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const { maxRetries, baseDelay, maxDelay } = { ...this.defaultRetryOptions, ...options };
    
    for (let attempt = 0; attempt <= maxRetries!; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        // Comprehensive error classification for Google APIs
        const statusCode = error?.response?.status || error?.status || error?.code;
        const isQuotaError = statusCode === 429 || 
                           (statusCode === 403 && this.isGoogleQuotaError(error));
        
        const isTemporaryError = statusCode >= 500 && statusCode < 600;
        const isNetworkError = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'].includes(error?.code);
        
        // Only retry for quota, temporary server errors, or network issues
        if (!isQuotaError && !isTemporaryError && !isNetworkError) {
          throw error;
        }
        
        // Don't retry if we've reached max attempts
        if (attempt === maxRetries) {
          console.error(`Google Sheets API failed after ${maxRetries + 1} attempts:`, error);
          throw error;
        }
        
        // Honor Retry-After header if present
        let delay: number;
        const retryAfter = error?.response?.headers?.['retry-after'];
        if (retryAfter) {
          delay = parseInt(retryAfter) * 1000; // Convert to milliseconds
          console.warn(`Google Sheets API respecting Retry-After: ${retryAfter}s`);
        } else {
          // Use full jitter exponential backoff
          const maxDelayForAttempt = Math.min(baseDelay! * Math.pow(2, attempt), maxDelay!);
          delay = Math.random() * maxDelayForAttempt;
        }
        
        const errorType = isQuotaError ? 'quota' : isTemporaryError ? 'server' : 'network';
        console.warn(`Google Sheets API ${errorType} error on attempt ${attempt + 1}/${maxRetries! + 1}, retrying in ${Math.round(delay)}ms...`);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Retry loop completed without success or failure');
  }

  private isGoogleQuotaError(error: any): boolean {
    // Check for Google-specific quota error reasons
    const errors = error?.response?.data?.error?.errors || error?.data?.error?.errors || error?.errors || [];
    return errors.some((err: any) => 
      ['userRateLimitExceeded', 'rateLimitExceeded', 'quotaExceeded', 'backendError'].includes(err.reason)
    );
  }
  private async getSheetsService(userId: string) {
    const auth = await getValidGoogleClient(userId);
    return google.sheets({ version: 'v4', auth });
  }
  private spreadsheetId: string;

  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.INVENTORY_SPREADSHEET_ID || "default_spreadsheet_id";
  }

  async createSpreadsheet(userId: string, title: string): Promise<string> {
    return this.retryWithExponentialBackoff(async () => {
      const sheets = await this.getSheetsService(userId);
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
      
      // Initialize headers for each sheet (already has retry logic via appendRows)
      await this.initializeSheetHeaders(userId);
      
      return spreadsheetId;
    });
  }

  private async initializeSheetHeaders(userId: string) {
    const headers = {
      Rooms: ['room_id', 'room_name', 'description', 'created_at', 'created_by', 'drive_folder'],
      Boxes: ['box_id', 'room_id', 'box_label', 'notes', 'created_at', 'drive_folder', 'qr_code'],
      Items: ['item_id', 'box_id', 'name', 'description', 'qty', 'primary_photo_file_id', 'created_at'],
      ItemPhotos: ['item_photo_id', 'item_id', 'drive_file_id', 'web_view_link', 'thumb_link', 'created_at'],
      Memberships: ['membership_id', 'room_id', 'user_id', 'role', 'created_at'],
      PullSheets: ['pull_sheet_id', 'box_id', 'qr_image_drive_file_id', 'last_generated_at'],
    };

    for (const [sheetName, headerRow] of Object.entries(headers)) {
      await this.appendRows(userId, sheetName, [headerRow]);
    }
  }

  async getRows(userId: string, sheetName: string, range?: string): Promise<string[][]> {
    return this.retryWithExponentialBackoff(async () => {
      const sheets = await this.getSheetsService(userId);
      const fullRange = range ? `${sheetName}!${range}` : sheetName;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: fullRange,
      });

      return response.data.values || [];
    });
  }

  async appendRows(userId: string, sheetName: string, rows: (string | number | null)[][]): Promise<void> {
    return this.retryWithExponentialBackoff(async () => {
      const sheets = await this.getSheetsService(userId);
      await sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: sheetName,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: rows,
        },
      });
    });
  }

  async updateRows(userId: string, sheetName: string, range: string, rows: (string | number | null)[][]): Promise<void> {
    return this.retryWithExponentialBackoff(async () => {
      const sheets = await this.getSheetsService(userId);
      await sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: `${sheetName}!${range}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: rows,
        },
      });
    });
  }

  async batchUpdate(userId: string, requests: any[]): Promise<void> {
    return this.retryWithExponentialBackoff(async () => {
      const sheets = await this.getSheetsService(userId);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests,
        },
      });
    });
  }

  async findRowByValue(userId: string, sheetName: string, columnIndex: number, value: string): Promise<number | null> {
    // getRows already uses exponential backoff, so we just need the search logic
    const rows = await this.getRows(userId, sheetName);
    
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][columnIndex] === value) {
        return i + 1; // Sheets are 1-indexed
      }
    }
    
    return null;
  }
}

export const googleSheetsService = new GoogleSheetsService();
