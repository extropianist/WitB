import { OAuth2Client } from 'google-auth-library';
import { storage } from '../storage.js';
import type { InsertGoogleTokens } from '../../shared/schema.js';

// Factory function to create a new OAuth client for each request
function createOAuth2Client(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/api/auth/google/callback`;
  
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth configuration missing: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required');
  }
  
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export async function verifyGoogleToken(token: string): Promise<GoogleUserInfo | null> {
  try {
    const client = createOAuth2Client();
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) return null;

    return {
      id: payload.sub,
      email: payload.email!,
      name: payload.name!,
      picture: payload.picture!,
    };
  } catch (error) {
    console.error('Google token verification failed:', error);
    return null;
  }
}

export function getGoogleAuthUrl(state?: string): string {
  const client = createOAuth2Client();
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ];

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    include_granted_scopes: true,
    prompt: 'consent', // Ensure we get refresh token
    state: state, // CSRF protection
  });
}

export async function getGoogleTokens(code: string) {
  try {
    const client = createOAuth2Client();
    const { tokens } = await client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Failed to get Google tokens:', error);
    throw error;
  }
}

export async function saveUserGoogleTokens(userId: string, tokens: any): Promise<void> {
  try {
    // Validate token data
    if (!tokens.access_token) {
      throw new Error('Access token is required');
    }
    
    // Parse and validate scopes - ensure proper string[] type
    let scopes: string[] | null = null;
    if (tokens.scope && typeof tokens.scope === 'string') {
      const scopeList = tokens.scope.split(' ').filter((s: string) => s.trim().length > 0);
      scopes = scopeList.length > 0 ? [...scopeList] : null;
    }
    
    const tokenData: InsertGoogleTokens = {
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes
    };
    
    // Check if tokens already exist for this user
    const existingTokens = await storage.getGoogleTokens(userId);
    
    if (existingTokens) {
      await storage.updateGoogleTokens(userId, tokenData);
    } else {
      await storage.saveGoogleTokens(tokenData);
    }
  } catch (error) {
    console.error('Failed to save Google tokens:', error);
    throw error;
  }
}

export async function refreshUserGoogleTokens(userId: string): Promise<any> {
  try {
    const storedTokens = await storage.getGoogleTokens(userId);
    if (!storedTokens || !storedTokens.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const client = createOAuth2Client();
    client.setCredentials({
      refresh_token: storedTokens.refreshToken
    });
    
    const tokenResponse = await client.getAccessToken();
    
    if (!tokenResponse.token) {
      throw new Error('Failed to obtain new access token');
    }
    
    // Calculate expiry - use expires_in if available, otherwise set conservative 1 hour TTL
    let expiryDate: Date;
    if (tokenResponse.res?.data.expires_in) {
      expiryDate = new Date(Date.now() + tokenResponse.res.data.expires_in * 1000);
    } else {
      // Conservative 1 hour TTL if expires_in is not provided
      console.warn('expires_in not provided by Google, using conservative 1 hour TTL');
      expiryDate = new Date(Date.now() + 60 * 60 * 1000);
    }
    
    // Update stored tokens with reliable expiry
    await storage.refreshGoogleTokens(userId, {
      accessToken: tokenResponse.token,
      expiryDate
    });
    
    console.log(`Successfully refreshed tokens for user ${userId}, expires at ${expiryDate.toISOString()}`);
    
    return { 
      access_token: tokenResponse.token, 
      expiry_date: expiryDate.getTime()
    };
  } catch (error) {
    console.error('Failed to refresh Google tokens:', error);
    throw error;
  }
}

export async function getValidGoogleClient(userId: string): Promise<OAuth2Client> {
  const storedTokens = await storage.getGoogleTokens(userId);
  if (!storedTokens) {
    throw new Error('No Google tokens found for user');
  }
  
  const client = createOAuth2Client();
  
  // Check if token is expired or will expire soon (within 5 minutes)
  // Treat missing expiry date as expired for safety
  const now = new Date();
  const expiryThreshold = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
  const shouldRefresh = !storedTokens.expiryDate || storedTokens.expiryDate <= expiryThreshold;
  
  if (shouldRefresh) {
    // Token is expired, missing expiry, or will expire soon - refresh it
    if (storedTokens.refreshToken) {
      try {
        await refreshUserGoogleTokens(userId);
        // Get updated tokens
        const updatedTokens = await storage.getGoogleTokens(userId);
        if (updatedTokens) {
          client.setCredentials({
            access_token: updatedTokens.accessToken,
            refresh_token: updatedTokens.refreshToken,
            expiry_date: updatedTokens.expiryDate?.getTime()
          });
        } else {
          throw new Error('Failed to retrieve updated tokens after refresh');
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
        throw new Error('Failed to refresh expired Google tokens');
      }
    } else {
      throw new Error('Token expired and no refresh token available');
    }
  } else {
    // Token is still valid
    client.setCredentials({
      access_token: storedTokens.accessToken,
      refresh_token: storedTokens.refreshToken,
      expiry_date: storedTokens.expiryDate?.getTime()
    });
  }
  
  return client;
}

// Token revocation function
export async function revokeGoogleTokens(userId: string): Promise<void> {
  try {
    const storedTokens = await storage.getGoogleTokens(userId);
    if (!storedTokens) {
      return;
    }
    
    const client = createOAuth2Client();
    client.setCredentials({
      access_token: storedTokens.accessToken,
      refresh_token: storedTokens.refreshToken
    });
    
    // Revoke refresh token first (stronger), fallback to access token
    try {
      if (storedTokens.refreshToken) {
        await client.revokeToken(storedTokens.refreshToken);
      } else {
        await client.revokeToken(storedTokens.accessToken);
      }
    } catch (revokeError) {
      // If refresh token revocation fails, try access token
      await client.revokeToken(storedTokens.accessToken);
    }
  } catch (error) {
    console.error('Failed to revoke Google tokens:', error);
    // Don't throw - we still want to delete local tokens even if revocation fails
  }
}

export { createOAuth2Client };
