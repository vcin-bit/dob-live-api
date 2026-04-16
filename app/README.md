# DOB Live React App

Security Officer and Operations Manager dashboard for DOB Live security management platform.

## 🏗️ Architecture

- **Frontend**: React 18 + Vite + React Router
- **Authentication**: Clerk
- **Styling**: Custom CSS with professional security theme
- **Icons**: Heroicons
- **API**: REST API on Render (Node.js + Express + Supabase)

## 📱 Features

### Officer App
- **Site Selection**: Choose work location
- **Dashboard**: Recent logs, pending tasks, shift status
- **Log Entry**: Comprehensive form with 16 log types
  - GPS location capture with What3Words
  - Type-specific fields (incident, patrol, maintenance, etc.)
  - Rich form validation and datetime picker
- **Log History**: Filterable history with expandable cards
- **Task Management**: Status updates, priority indicators
- **Mobile Navigation**: Bottom tab navigation

### Manager App (Coming Soon)
- Team overview
- Site management
- Reporting and analytics
- Task assignment

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables
Copy `.env.example` to `.env` and configure:
```bash
VITE_API_URL=https://dob-live-api.onrender.com
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_public_key
```

## 🌐 Deployment

### Cloudflare Pages (Recommended)
1. Connect GitHub repository
2. Set build settings:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `app`
3. Add environment variables in Cloudflare dashboard
4. Deploy to `app.doblive.co.uk`

### Alternative: Vercel/Netlify
Works with zero configuration - just connect the repo.

## 🔑 Authentication

Uses Clerk for authentication with the following features:
- Email/password sign in
- User profile management
- Role-based access (OFFICER, OPS_MANAGER, COMPANY, SUPER_ADMIN)
- Session management
- Automatic JWT token handling

## 🎨 Design System

Professional security-focused design with:
- **Colors**: Slate grays with cyan accents
- **Typography**: Inter + JetBrains Mono
- **Components**: Cards, buttons, forms, status badges
- **Responsive**: Mobile-first with bottom navigation
- **Interactions**: Smooth animations and hover states

## 📋 Log Types

Supports 16+ security log types:
- **Operations**: PATROL, SHIFT_START, SHIFT_END, BREAK, HANDOVER
- **Security**: INCIDENT, ALARM, ACCESS_CONTROL, VISITOR, VEHICLE_CHECK
- **Maintenance**: MAINTENANCE, PROPERTY_CHECK
- **Emergency**: EMERGENCY, FIRE_ALARM, MEDICAL, EVACUATION
- **Admin**: TRAINING, ADMIN, OTHER

Each type has specific fields and validation rules.

## 🔌 API Integration

Connects to DOB Live API with:
- Automatic authentication headers
- Error handling with user-friendly messages
- Loading states and offline support
- Type-safe request/response handling

## 📁 Project Structure

```
app/
├── src/
│   ├── App.jsx              # Main app component with routing
│   ├── index.css            # Global styles and design system
│   ├── main.jsx             # React entry point
│   └── lib/
│       ├── api.js           # API client and methods
│       └── constants.js     # Log types, status enums, utilities
├── public/
│   ├── favicon.svg          # DOB Live favicon
│   └── index.html           # HTML template
├── package.json             # Dependencies and scripts
├── vite.config.js           # Vite configuration
└── .env.example             # Environment variables template
```

## 🔒 Security

- All API requests include JWT authentication
- Environment variables for sensitive config
- Input validation on forms
- XSS protection with React's built-in escaping
- HTTPS enforced in production

## 📱 Mobile Support

- Responsive design works on all devices
- Touch-friendly interface with proper tap targets
- Bottom navigation optimized for mobile use
- Safe area support for notched devices
- Prevents zoom on form inputs (iOS)

## 🐛 Debugging

Enable debug mode with:
```bash
VITE_DEBUG=true
```

This will show:
- API request/response logging
- Authentication state changes
- Form validation messages
