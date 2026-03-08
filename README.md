# DOB·LIVE API

Digital Occurrence Book — Backend API for UK Security Companies.

## Stack
- Node.js + Express
- MongoDB Atlas
- JWT Authentication
- SendGrid (password reset)

## Setup

1. Copy `.env.example` to `.env` and fill in values
2. `npm install`
3. `npm run seed` — populates demo data
4. `npm start`

## Seed Credentials
| Role | Email | Password |
|------|-------|----------|
| Ops Manager | fletcher@risksecured.co.uk | fletcher123 |
| Officer | j.harris@risksecured.co.uk | harris123 |
| Officer | t.dawson@risksecured.co.uk | dawson123 |
| Officer | l.webb@risksecured.co.uk | webb123 |
| Super Admin | admin@psingroup.co.uk | psin-admin-2026 |

## API Endpoints

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/refresh`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET  /api/auth/me`

### Entries
- `POST /api/entries`
- `GET  /api/entries?date=YYYY-MM-DD&siteId=&type=&officerId=`
- `GET  /api/entries/:id`

### Officers
- `GET    /api/officers`
- `POST   /api/officers`
- `PUT    /api/officers/:id`
- `DELETE /api/officers/:id`
- `GET    /api/officers/:id/status`

### Sites
- `GET    /api/sites`
- `POST   /api/sites`
- `PUT    /api/sites/:id`
- `DELETE /api/sites/:id`

### Dashboard
- `GET /api/dashboard`
- `GET /api/dashboard/feed`

### Admin (SUPER_ADMIN only)
- `GET  /api/admin/companies`
- `POST /api/admin/companies`
- `GET  /api/admin/stats`

### Health
- `GET /api/health`
