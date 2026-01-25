import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './lib/AuthContext';
import { ShopProvider } from './lib/ShopContext';
import { BrandProvider } from './lib/BrandContext';
import { ErrorBoundary } from './components/ErrorBoundary';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `/sw.js?v=${__BUILD_ID__}`;
    navigator.serviceWorker.register(swUrl)
      .then((registration) => {
        console.log('Service Worker registered:', registration);
        registration.update();

        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ShopProvider>
        <BrandProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrandProvider>
      </ShopProvider>
    </ErrorBoundary>
  </StrictMode>
);
