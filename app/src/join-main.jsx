import React from 'react';
import ReactDOM from 'react-dom/client';
import { JoinForm } from './components/JoinForm';
import './index.css';

// No Clerk — this page is opened by unauthenticated officers from a texted link.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <JoinForm />
  </React.StrictMode>
);
