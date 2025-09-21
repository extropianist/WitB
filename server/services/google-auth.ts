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
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      throw new Error('Google Client ID not configured');
    }
    
    // Enhanced token verification with proper audience validation
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: clientId, // Verify the token was issued for our app
    });

    const payload = ticket.getPayload();
    if (!payload) {
      console.warn('Google token verification succeeded but payload is empty');
      return null;
    }

    // Validate required fields are present
    if (!payload.sub || !payload.email || !payload.name) {
      console.warn('Google token payload missing required fields');
      return null;
    }

    // Additional security checks
    if (payload.aud !== clientId) {
      console.warn('Google token audience mismatch');
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture || '',
    };
  } catch (error) {
    console.error('Google token verification failed:', error);
    return null;
  }
}

export function getGoogleAuthUrl(state?: string): string {
  const client = createOAuth2Client();
  
  // Define scopes with proper validation
  const scopes = [
    'openid',
    'email', 
    'profile',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ];

  try {
    const authUrl = client.generateAuthUrl({
      access_type: 'offline', // Required for refresh tokens
      scope: scopes,
      include_granted_scopes: true,
      prompt: 'consent', // Force consent to ensure refresh token
      state: state, // CSRF protection
      response_type: 'code', // Explicit authorization code flow
    });
    
    console.log('Generated Google auth URL with scopes:', scopes);
    return authUrl;
  } catch (error) {
    console.error('Failed to generate Google auth URL:', error);
    throw new Error(`Failed to generate authentication URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function getGoogleTokens(code: string) {
  try {
    const client = createOAuth2Client();
    const { tokens } = await client.getToken(code);
    
    // Validate that we received the required tokens
    if (!tokens.access_token) {
      throw new Error('No access token received from Google');
    }
    
    // Log token acquisition for debugging (without exposing tokens)
    console.log('Successfully acquired Google tokens', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      hasIdToken: !!tokens.id_token,
      scopes: tokens.scope,
      expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'none'
    });
    
    return tokens;
  } catch (error) {
    console.error('Failed to get Google tokens:', error);
    throw new Error(`Google token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      scopes = scopeList.length > 0 ? Array.from(scopeList) : null;
    }
    
    // Check if tokens already exist for this user
    const existingTokens = await storage.getGoogleTokens(userId);
    
    if (existingTokens) {
      // For updates, create partial update object
      const updateData = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scopes
      };
      await storage.updateGoogleTokens(userId, updateData);
    } else {
      // For new tokens, create insert object
      const insertData: InsertGoogleTokens = {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scopes
      };
      await storage.saveGoogleTokens(insertData);
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
      throw new Error('No refresh token available for user');
    }
    
    const client = createOAuth2Client();
    
    // Enhanced credential handling with proper error catching
    try {
      client.setCredentials({
        refresh_token: storedTokens.refreshToken
      });
    } catch (error) {
      throw new Error(`Failed to set refresh token credentials: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Attempt token refresh with better error handling
    let tokenResponse;
    try {
      tokenResponse = await client.getAccessToken();
    } catch (error) {
      // Check if this is a refresh token revocation error
      if (error instanceof Error && (error.message.includes('invalid_grant') || error.message.includes('Token has been expired or revoked'))) {
        throw new Error('Refresh token has been revoked. User must re-authenticate.');
      }
      throw new Error(`Token refresh request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    if (!tokenResponse.token) {
      throw new Error('Google returned empty access token');
    }
    
    // Enhanced expiry calculation with validation
    let expiryDate: Date;
    const expiresInSeconds = tokenResponse.res?.data.expires_in;
    
    if (expiresInSeconds && typeof expiresInSeconds === 'number' && expiresInSeconds > 0) {
      expiryDate = new Date(Date.now() + expiresInSeconds * 1000);
    } else {
      // Conservative 1 hour TTL with warning
      console.warn(`Invalid or missing expires_in (${expiresInSeconds}) from Google, using conservative 1 hour TTL`);
      expiryDate = new Date(Date.now() + 60 * 60 * 1000);
    }
    
    // Validate the new expiry isn't in the past
    if (expiryDate <= new Date()) {
      throw new Error('Received token with past expiry date');
    }
    
    // Update stored tokens
    const updatedTokens = await storage.refreshGoogleTokens(userId, {
      accessToken: tokenResponse.token,
      expiryDate
    });
    
    if (!updatedTokens) {
      throw new Error('Failed to store refreshed tokens');
    }
    
    console.log(`Successfully refreshed tokens for user ${userId}, expires at ${expiryDate.toISOString()}`);
    
    return { 
      access_token: tokenResponse.token, 
      expiry_date: expiryDate.getTime()
    };
  } catch (error) {
    console.error(`Failed to refresh Google tokens for user ${userId}:`, error);
    throw error; // Re-throw to maintain error context
  }
}

export async function getValidGoogleClient(userId: string): Promise<OAuth2Client> {
  const storedTokens = await storage.getGoogleTokens(userId);
  if (!storedTokens) {
    throw new Error('No Google tokens found for user');
  }
  
  const client = createOAuth2Client();
  
  // Enhanced token validation with better error handling
  const now = new Date();
  const expiryThreshold = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes buffer
  const shouldRefresh = !storedTokens.expiryDate || storedTokens.expiryDate <= expiryThreshold;
  
  if (shouldRefresh) {
    // Token needs refresh
    if (!storedTokens.refreshToken) {
      throw new Error('Token expired and no refresh token available. User must re-authenticate.');
    }
    
    try {
      console.log(`Refreshing expired tokens for user ${userId}`);
      await refreshUserGoogleTokens(userId);
      
      // Get updated tokens and verify they're valid
      const updatedTokens = await storage.getGoogleTokens(userId);
      if (!updatedTokens || !updatedTokens.accessToken) {
        throw new Error('Failed to retrieve valid tokens after refresh');
      }
      
      // Verify the new token isn't already expired
      if (updatedTokens.expiryDate && updatedTokens.expiryDate <= now) {
        throw new Error('Received expired token from refresh');
      }
      
      client.setCredentials({
        access_token: updatedTokens.accessToken,
        refresh_token: updatedTokens.refreshToken,
        expiry_date: updatedTokens.expiryDate?.getTime()
      });
      
      console.log(`Successfully refreshed tokens for user ${userId}`);
    } catch (error) {
      console.error(`Token refresh failed for user ${userId}:`, error);
      throw new Error(`Failed to refresh expired Google tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    // Token is still valid - set credentials
    client.setCredentials({
      access_token: storedTokens.accessToken,
      refresh_token: storedTokens.refreshToken,
      expiry_date: storedTokens.expiryDate?.getTime()
    });
    
    console.log(`Using valid tokens for user ${userId}, expires: ${storedTokens.expiryDate?.toISOString() || 'unknown'}`);
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
