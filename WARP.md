# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

HamaraLabs Calendar is a Next.js calendar booking application built with:
- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js v5 with Authentik provider
- **UI**: Tailwind CSS with Radix UI components
- **Calendar**: react-big-calendar for scheduling interface
- **Deployment**: Docker containerization with standalone output

## Essential Commands

### Development
```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run ESLint
npm run lint
```

### Database Operations
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Deploy migrations to production
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# Create new migration
npx prisma migrate dev --name <migration_name>
```

### Docker Operations
```bash
# Start services (database + app)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and start
docker-compose up -d --build
```

## Architecture Overview

### Core Data Models
- **User**: Contains authentication info, username, and metadata (isPublic, callOnBook flags)
- **Schedule**: User's available time slots for a specific date
- **Booking**: Confirmed appointments linking users to time slots with guest information  
- **Slot**: Payment/transaction records that can be associated with bookings

### Key Application Flow
1. **Authentication**: Authentik SSO → User creation/login → Session management
2. **Scheduling**: Users create time slots → Public booking pages generated
3. **Booking**: Guests book available slots → Automatic slot removal → Optional phone call trigger
4. **Management**: Dashboard for viewing/managing schedules and bookings

### Directory Structure
- `app/` - Next.js App Router pages and API routes
- `components/` - React components (Calendar.tsx, Navigation.tsx, UI components)
- `lib/` - Utilities (auth configuration, database connection, utils)
- `prisma/` - Database schema and migrations
- `types/` - TypeScript type definitions

### Authentication System
- Uses NextAuth.js v5 with Authentik provider
- Auto-generates unique usernames from email addresses
- Middleware protects all routes except public booking pages
- User metadata stored in JSON field for feature flags

### API Architecture
- RESTful endpoints under `app/api/`
- Public booking API at `/api/bookings` (POST for creating bookings)
- Protected endpoints for user schedules and management
- CORS enabled for cross-origin requests

### Time Handling
- All dates stored as UTC midnight for consistency
- Frontend date inputs converted to "yyyy-MM-dd" format
- Booking validation prevents past date selections
- Time slots stored as string arrays (e.g., ["9:00-10:00", "10:00-11:00"])

## Environment Variables

Required variables (see `.env` file):
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - NextAuth.js secret key
- `AUTHENTIK_CLIENT_ID` - Authentik OAuth client ID
- `AUTHENTIK_CLIENT_SECRET` - Authentik OAuth client secret
- `AUTHENTIK_ISSUER` - Authentik issuer URL
- `AUTHENTIK_URL` - Authentik base URL

## Development Notes

### Database Schema Changes
Always create migrations for schema changes:
```bash
npx prisma migrate dev --name descriptive_name
```

### Time Zone Considerations
- Database stores UTC timestamps
- Frontend handles local time display
- Booking validation uses UTC day boundaries

### Public Booking Flow
- Public pages accessible at `/schedule/[username]`
- No authentication required for booking creation
- Username-based user lookup for schedule access

### External Integrations
- Optional phone call trigger on booking (callOnBook metadata flag)
- Cloud function endpoint for automated calls

### Docker Deployment
- Standalone Next.js output for containerization
- PostgreSQL service with persistent volume
- Environment file mounting for configuration