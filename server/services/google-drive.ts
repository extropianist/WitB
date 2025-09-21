import { google } from 'googleapis';
import { getValidGoogleClient } from './google-auth.js';
import { storage } from '../storage.js';

export interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

class GoogleDriveService {
  private async getDriveService(userId: string) {
    const auth = await getValidGoogleClient(userId);
    return google.drive({ version: 'v3', auth });
  }

  async getAppRootFolder(userId: string): Promise<string> {
    try {
      // Check persistent cache first
      const cachedFolder = await storage.getDriveFolderCache(userId);
      if (cachedFolder) {
        return cachedFolder.appRootFolderId;
      }

      // Search for existing app folder in Google Drive
      const drive = await this.getDriveService(userId);
      const response = await drive.files.list({
        q: "name='InventoryApp' and mimeType='application/vnd.google-apps.folder'",
        fields: 'files(id, name)',
      });

      let folderId: string;

      if (response.data.files && response.data.files.length > 0) {
        // Found existing folder, cache it
        folderId = response.data.files[0].id!;
      } else {
        // Create app root folder if it doesn't exist
        const createResponse = await drive.files.create({
          requestBody: {
            name: 'InventoryApp',
            mimeType: 'application/vnd.google-apps.folder',
          },
          fields: 'id',
        });
        folderId = createResponse.data.id!;
      }

      // Save to persistent cache
      await storage.saveDriveFolderCache({
        userId,
        appRootFolderId: folderId
      });

      return folderId;
    } catch (error) {
      console.error('Failed to get/create app root folder:', error);
      throw error;
    }
  }

  async createFolder(userId: string, name: string, parentId?: string): Promise<string> {
    try {
      const parent = parentId || await this.getAppRootFolder(userId);
      const drive = await this.getDriveService(userId);
      
      const response = await drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parent],
        },
        fields: 'id',
      });

      return response.data.id!;
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  }

  async uploadFile(
    userId: string,
    fileName: string,
    mimeType: string,
    fileData: Buffer,
    parentId?: string
  ): Promise<DriveFile> {
    try {
      const parent = parentId || await this.getAppRootFolder(userId);
      const drive = await this.getDriveService(userId);
      
      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [parent],
        },
        media: {
          mimeType,
          body: fileData,
        },
        fields: 'id, name, webViewLink, webContentLink, thumbnailLink',
      });

      const file = response.data;
      return {
        id: file.id!,
        name: file.name!,
        webViewLink: file.webViewLink!,
        webContentLink: file.webContentLink || undefined,
        thumbnailLink: file.thumbnailLink || undefined,
      };
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }

  async getFile(userId: string, fileId: string): Promise<DriveFile> {
    try {
      const drive = await this.getDriveService(userId);
      const response = await drive.files.get({
        fileId,
        fields: 'id, name, webViewLink, webContentLink, thumbnailLink',
      });

      const file = response.data;
      return {
        id: file.id!,
        name: file.name!,
        webViewLink: file.webViewLink!,
        webContentLink: file.webContentLink || undefined,
        thumbnailLink: file.thumbnailLink || undefined,
      };
    } catch (error) {
      console.error('Failed to get file:', error);
      throw error;
    }
  }

  async deleteFile(userId: string, fileId: string): Promise<void> {
    try {
      const drive = await this.getDriveService(userId);
      await drive.files.delete({
        fileId,
      });
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  async getFileViewLink(userId: string, fileId: string): Promise<string> {
    try {
      const drive = await this.getDriveService(userId);
      const response = await drive.files.get({
        fileId,
        fields: 'webViewLink'
      });
      
      return response.data.webViewLink || '';
    } catch (error) {
      console.error(`Failed to get file view link for ${fileId}:`, error);
      throw error;
    }
  }

  async getFileBytes(userId: string, fileId: string): Promise<Buffer> {
    try {
      const drive = await this.getDriveService(userId);
      const response = await drive.files.get({
        fileId,
        alt: 'media'
      }, {
        responseType: 'arraybuffer'
      });
      
      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      console.error(`Failed to get file bytes for ${fileId}:`, error);
      throw error;
    }
  }

  async createThumbnail(userId: string, originalFileId: string, parentId?: string): Promise<DriveFile> {
    try {
      // For now, we'll return the original file as a placeholder
      // In a real implementation, you would use an image processing service
      // to create a thumbnail and upload it
      return await this.getFile(userId, originalFileId);
    } catch (error) {
      console.error('Failed to create thumbnail:', error);
      throw error;
    }
  }

  async moveFile(userId: string, fileId: string, newParentId: string): Promise<void> {
    try {
      const drive = await this.getDriveService(userId);
      // Get current parents
      const file = await drive.files.get({
        fileId,
        fields: 'parents',
      });

      const previousParents = file.data.parents?.join(',');

      // Move file to new parent
      await drive.files.update({
        fileId,
        addParents: newParentId,
        removeParents: previousParents,
        fields: 'id, parents',
      });
    } catch (error) {
      console.error('Failed to move file:', error);
      throw error;
    }
  }
}

export const googleDriveService = new GoogleDriveService();
