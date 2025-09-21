# Inventory Management System

## Overview

This is a hierarchical inventory management system built with Google Workspace integration. The system organizes inventory using a three-tier structure: ROOM → BOX → ITEM (with photos). It provides role-based access control with Admin and Viewer permissions, uses Google Sign-In for authentication, stores data in Google Sheets, and manages files in Google Drive. The application features QR code generation for boxes, photo management through Google Picker API, and export capabilities for data backup and pull sheets.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state and caching
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with CSS variables for theming
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js server
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Session Management**: Express sessions with connect-pg-simple for PostgreSQL session storage
- **File Structure**: Monorepo with shared schema between client and server

### Authentication & Authorization
- **Provider**: Local username/password authentication with bcrypt hashing
- **Session Storage**: Server-side sessions with express-session and file-based user storage (lowdb)
- **Password Security**: Bcrypt with 12 salt rounds, minimum 6 character passwords
- **User Management**: File-based database with user registration/login system
- **Session Management**: Secure session cookies with httpOnly, sameSite, and production-ready settings
- **Access Control**: Role-based permissions (Admin/Viewer) with room-level memberships (to be updated)
- **Security**: Session regeneration on login/register prevents fixation attacks

### Data Storage
- **User Database**: File-based database (lowdb) with the following local user schema:
  - Users (ID, username, hashed password, creation date)
- **Primary Database**: PostgreSQL with the following schema (to be migrated):
  - Users (extended to support both local and Google users)
  - Rooms (hierarchical container for organization)
  - Boxes (mid-level containers with QR codes)
  - Items (individual inventory items)
  - Item Photos (photo metadata and Drive links)
  - Memberships (user-room relationships with roles)
- **ORM**: Drizzle with type-safe queries and migrations
- **File Storage**: Google Drive with organized folder structure (Room folders containing Box subfolders)

### API Design
- **Pattern**: RESTful API with nested resource routes
- **Structure**: `/api/rooms/:id/boxes` and `/api/boxes/:id/items`
- **Validation**: Zod schemas shared between client and server
- **Error Handling**: Centralized error middleware with proper HTTP status codes

### Photo Management
- **Upload**: Google Picker API for file selection and upload to Drive
- **Storage**: Original images stored in Drive with organized folder structure
- **Display**: Direct Drive links for image viewing with thumbnail support
- **Organization**: Room-specific folders with box subfolders for photo organization

### QR Code System
- **Generation**: Server-side QR code creation using qrcode library
- **Storage**: QR images stored in Google Drive within box folders
- **Access**: QR codes resolve to `/box/:id` with authentication required
- **Regeneration**: Admin capability to regenerate QR codes when needed

### Export & Backup Features
- **Room Backup**: ZIP export containing CSV data and associated photos
- **Pull Sheets**: PDF generation for individual box contents
- **Data Format**: CSV export maintaining relational structure for data portability

## External Dependencies

### Google Services
- **Google Identity Services**: OAuth2/OIDC authentication and user consent
- **Google Drive API**: File storage, folder management, and photo hosting
- **Google Sheets API**: Alternative data storage option (configurable)
- **Google Picker API**: User-friendly file selection and upload interface

### Database & Storage
- **PostgreSQL**: Primary database with Neon serverless hosting
- **Drizzle ORM**: Type-safe database operations and schema management

### UI & Styling
- **Radix UI**: Accessible component primitives for consistent user experience
- **Tailwind CSS**: Utility-first styling with design system variables
- **Lucide React**: Icon library for consistent iconography

### Development & Build Tools
- **Vite**: Fast development server and optimized production builds
- **TypeScript**: Type safety across the entire application stack
- **ESLint**: Code quality and consistency enforcement

### Hosting & Deployment
- **Replit Deployments**: Autoscale hosting with option to upgrade to Reserved VM
- **Static Assets**: Potential separation to Static Deployments for optimization