import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

import { InspectionPortalApp } from './components/InspectionPortal'

function InspectRoot() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <InspectionPortalApp />
    </ClerkProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <InspectRoot />
  </React.StrictMode>,
)
