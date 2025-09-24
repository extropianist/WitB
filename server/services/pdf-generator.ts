import PDFDocument from 'pdfkit';
import { storage } from '../storage.js';
import { qrGeneratorService } from './qr-generator.js';

export interface PullSheetData {
  box: {
    id: string;
    label: string;
    notes?: string | null;
    roomName: string;
  };
  items: {
    id: string;
    name: string;
    description?: string | null;
    quantity: number;
  }[];
}

class PDFGeneratorService {
  async generatePullSheet(boxId: string): Promise<Buffer> {
    try {
      // Get box and related data
      const box = await storage.getBox(boxId);
      if (!box) {
        throw new Error('Box not found');
      }

      const room = await storage.getRoom(box.roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const items = await storage.getItemsByBox(boxId);

      // Create PDF document
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 50,
        info: {
          Title: `Pull Sheet - ${box.label}`,
          Author: 'Inventory Management System',
          Subject: `Box contents for ${box.label}`,
          CreatedDate: new Date()
        }
      });

      // Generate header
      this.addHeader(doc, {
        box: {
          id: box.id,
          label: box.label,
          notes: box.notes,
          roomName: room.name
        },
        items
      });

      // Generate QR code section
      await this.addQRCodeSection(doc, box.id);

      // Generate items table
      this.addItemsTable(doc, items);

      // Add footer
      this.addFooter(doc);

      // Finalize the PDF
      doc.end();

      // Convert to buffer
      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });
    } catch (error) {
      console.error('Failed to generate pull sheet:', error);
      throw error;
    }
  }

  private addHeader(doc: PDFKit.PDFDocument, data: PullSheetData): void {
    // Title
    doc.fontSize(20)
       .fillColor('#2563eb')
       .text('PULL SHEET', 50, 50, { align: 'center' });

    // Box information
    doc.fontSize(16)
       .fillColor('#000000')
       .text(`Box: ${data.box.label}`, 50, 100);

    doc.fontSize(12)
       .fillColor('#666666')
       .text(`Room: ${data.box.roomName}`, 50, 125);

    if (data.box.notes) {
      doc.text(`Notes: ${data.box.notes}`, 50, 145);
    }

    doc.fontSize(10)
       .text(`Generated: ${new Date().toLocaleString()}`, 50, data.box.notes ? 165 : 145);

    doc.fontSize(10)
       .text(`Box ID: ${data.box.id}`, 400, data.box.notes ? 165 : 145);
  }

  private async addQRCodeSection(doc: PDFKit.PDFDocument, boxId: string): Promise<void> {
    const currentY = 200;
    
    // QR Code section title
    doc.fontSize(14)
       .fillColor('#000000')
       .text('QR Code', 50, currentY);

    try {
      // Generate QR code as buffer
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000';
      const qrData = `${baseUrl}/box/${boxId}`;
      const qrBuffer = await qrGeneratorService.generateQRCode(qrData);

      // Add QR code image
      doc.image(qrBuffer, 50, currentY + 20, { width: 100, height: 100 });

      // Add QR code URL
      doc.fontSize(10)
         .fillColor('#666666')
         .text(`Scan to view: ${qrData}`, 160, currentY + 60);

    } catch (error) {
      console.error('Failed to add QR code to PDF:', error);
      doc.fontSize(10)
         .fillColor('#999999')
         .text('QR code unavailable', 50, currentY + 20);
    }
  }

  private addItemsTable(doc: PDFKit.PDFDocument, items: any[]): void {
    const startY = 340;
    let currentY = startY;

    // Table header
    doc.fontSize(14)
       .fillColor('#000000')
       .text('Items', 50, currentY);

    currentY += 30;

    if (items.length === 0) {
      doc.fontSize(12)
         .fillColor('#666666')
         .text('No items in this box', 50, currentY);
      return;
    }

    // Table headers
    doc.fontSize(12)
       .fillColor('#2563eb')
       .text('Qty', 50, currentY, { width: 40 })
       .text('Item Name', 100, currentY, { width: 200 })
       .text('Description', 320, currentY, { width: 200 });

    // Draw header line
    currentY += 20;
    doc.strokeColor('#e5e7eb')
       .lineWidth(1)
       .moveTo(50, currentY)
       .lineTo(545, currentY)
       .stroke();

    currentY += 10;

    // Table rows
    items.forEach((item, index) => {
      // Check if we need a new page
      if (currentY > 750) {
        doc.addPage();
        currentY = 50;
      }

      const rowColor = index % 2 === 0 ? '#f9fafb' : '#ffffff';
      
      // Row background
      doc.rect(50, currentY - 5, 495, 25)
         .fillColor(rowColor)
         .fill();

      // Row content
      doc.fillColor('#000000')
         .fontSize(11)
         .text(item.quantity.toString(), 50, currentY, { width: 40 })
         .text(item.name, 100, currentY, { width: 200 })
         .text(item.description || '-', 320, currentY, { width: 200 });

      currentY += 25;
    });

    // Summary
    currentY += 20;
    doc.fontSize(12)
       .fillColor('#374151')
       .text(`Total Items: ${items.length}`, 50, currentY);
  }

  private addFooter(doc: PDFKit.PDFDocument): void {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 50;

    doc.fontSize(10)
       .fillColor('#9ca3af')
       .text('Generated by Inventory Management System', 50, footerY, { align: 'center' });
  }
}

export const pdfGeneratorService = new PDFGeneratorService();