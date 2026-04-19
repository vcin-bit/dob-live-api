import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

window.onerror = function(msg, src, line, col, err) {
  if (!msg || msg === 'Script error.' || msg.includes('ResizeObserver')) return;
  console.error('App error:', msg, src, line);
  document.getElementById('root').innerHTML =
    '<div style="padding:2rem;font-family:sans-serif;background:#0b1222;min-height:100vh;color:#fff">' +
    '<div style="font-size:1.5rem;font-weight:800;margin-bottom:1rem"><span style="color:#1a52a8">DOB</span> Live</div>' +
    '<div style="background:#1a2235;border-radius:8px;padding:1rem;font-size:0.875rem">' +
    '<div style="color:#fca5a5;font-weight:600;margin-bottom:0.5rem">App Error</div>' +
    '<div style="color:rgba(255,255,255,0.6)">' + msg + '</div>' +
    '<div style="color:rgba(255,255,255,0.3);margin-top:0.5rem;font-size:0.75rem">' + src + ':' + line + '</div>' +
    '</div>' +
    '<button onclick="location.reload()" style="margin-top:1rem;padding:0.75rem 1.5rem;background:#1a52a8;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:1rem">Reload</button>' +
    '</div>';
};

// Don't replace page for unhandled promise rejections - just log them
window.onunhandledrejection = function(e) {
  console.error('Unhandled promise rejection:', e.reason);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
