import QRCode from 'qrcode';
import { googleDriveService } from './google-drive.js';

class QRGeneratorService {
  async generateQRCode(data: string): Promise<Buffer> {
    try {
      const qrCodeBuffer = await QRCode.toBuffer(data, {
        type: 'png',
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return qrCodeBuffer;
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      throw error;
    }
  }

  async generateAndUploadQRCode(userId: string, boxId: string, parentFolderId?: string): Promise<{ fileId: string; webViewLink: string }> {
    try {
      // Generate QR code with box URL
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000';
      const qrData = `${baseUrl}/box/${boxId}`;
      
      const qrCodeBuffer = await this.generateQRCode(qrData);
      
      // Upload to Google Drive
      const driveFile = await googleDriveService.uploadFile(
        userId,
        `qr-${boxId}.png`,
        'image/png',
        qrCodeBuffer,
        parentFolderId
      );

      return {
        fileId: driveFile.id,
        webViewLink: driveFile.webViewLink
      };
    } catch (error) {
      console.error('Failed to generate and upload QR code:', error);
      throw error;
    }
  }

  async regenerateQRCode(userId: string, boxId: string, oldFileId?: string, parentFolderId?: string): Promise<{ fileId: string; webViewLink: string }> {
    try {
      // Delete old QR code if it exists
      if (oldFileId) {
        try {
          await googleDriveService.deleteFile(userId, oldFileId);
        } catch (error) {
          console.warn('Failed to delete old QR code:', error);
        }
      }

      // Generate new QR code
      return await this.generateAndUploadQRCode(userId, boxId, parentFolderId);
    } catch (error) {
      console.error('Failed to regenerate QR code:', error);
      throw error;
    }
  }
}

export const qrGeneratorService = new QRGeneratorService();
