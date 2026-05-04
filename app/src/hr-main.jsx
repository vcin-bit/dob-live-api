import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider, SignedIn, SignedOut } from '@clerk/clerk-react'
import './index.css'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Lazy-load the HR portal components
import { HRPortalApp } from './components/HRPortal'

function HRRoot() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <HRPortalApp />
    </ClerkProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HRRoot />
  </React.StrictMode>,
)
