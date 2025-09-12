import { google } from 'googleapis';
import { googleAuthClient } from './google-auth.js';

const drive = google.drive({ version: 'v3', auth: googleAuthClient });

export interface DriveFile {
  id: string;
  name: string;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

class GoogleDriveService {
  private appRootFolderId: string | null = null;

  async getAppRootFolder(): Promise<string> {
    if (this.appRootFolderId) {
      return this.appRootFolderId;
    }

    try {
      // Search for existing app folder
      const response = await drive.files.list({
        q: "name='InventoryApp' and mimeType='application/vnd.google-apps.folder'",
        fields: 'files(id, name)',
      });

      if (response.data.files && response.data.files.length > 0) {
        this.appRootFolderId = response.data.files[0].id!;
        return this.appRootFolderId;
      }

      // Create app root folder if it doesn't exist
      const createResponse = await drive.files.create({
        requestBody: {
          name: 'InventoryApp',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });

      this.appRootFolderId = createResponse.data.id!;
      return this.appRootFolderId;
    } catch (error) {
      console.error('Failed to get/create app root folder:', error);
      throw error;
    }
  }

  async createFolder(name: string, parentId?: string): Promise<string> {
    try {
      const parent = parentId || await this.getAppRootFolder();
      
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
    fileName: string,
    mimeType: string,
    fileData: Buffer,
    parentId?: string
  ): Promise<DriveFile> {
    try {
      const parent = parentId || await this.getAppRootFolder();
      
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

  async getFile(fileId: string): Promise<DriveFile> {
    try {
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

  async deleteFile(fileId: string): Promise<void> {
    try {
      await drive.files.delete({
        fileId,
      });
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  async createThumbnail(originalFileId: string, parentId?: string): Promise<DriveFile> {
    try {
      // For now, we'll return the original file as a placeholder
      // In a real implementation, you would use an image processing service
      // to create a thumbnail and upload it
      return await this.getFile(originalFileId);
    } catch (error) {
      console.error('Failed to create thumbnail:', error);
      throw error;
    }
  }

  async moveFile(fileId: string, newParentId: string): Promise<void> {
    try {
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
