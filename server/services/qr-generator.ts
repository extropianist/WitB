import QRCode from 'qrcode';

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

  async generateQRCodeDataURL(data: string): Promise<string> {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(data, {
        type: 'image/png',
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      return qrCodeDataURL;
    } catch (error) {
      console.error('Failed to generate QR code data URL:', error);
      throw error;
    }
  }

  async generateQRCodeForBox(boxId: string): Promise<string> {
    try {
      // Generate QR code with box URL
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000';
      const qrData = `${baseUrl}/box/${boxId}`;
      
      return await this.generateQRCodeDataURL(qrData);
    } catch (error) {
      console.error('Failed to generate QR code for box:', error);
      throw error;
    }
  }

  async regenerateQRCodeForBox(boxId: string): Promise<string> {
    try {
      // Simply generate a new QR code (no need to delete anything since it's stored in database)
      return await this.generateQRCodeForBox(boxId);
    } catch (error) {
      console.error('Failed to regenerate QR code:', error);
      throw error;
    }
  }
}

export const qrGeneratorService = new QRGeneratorService();
