# Progressive Web App (PWA) Installation Guide

Your Auto Shop Manager is now a fully functional Progressive Web App! This means you can install it on any device and use it like a native mobile app.

## Features

- **Installable**: Add the app to your home screen on mobile or desktop
- **Offline Support**: Basic functionality works even without internet
- **App-like Experience**: Full screen mode without browser UI
- **Fast Loading**: Cached assets for quick startup

## How to Install

### On Android (Chrome/Edge)

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open Chrome on your Android device

3. Navigate to your computer's local IP address:
   - Find your IP: On your computer, run `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
   - Example: `http://192.168.1.100:5173`
   - Make sure your phone is on the same WiFi network

4. You'll see an "Install" prompt at the bottom of the screen or:
   - Tap the three dots menu (⋮)
   - Select "Add to Home screen" or "Install app"

5. Confirm the installation

6. The app will now appear on your home screen like a native app!

### On iPhone/iPad (Safari)

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open Safari on your iOS device

3. Navigate to your computer's local IP address:
   - Example: `http://192.168.1.100:5173`

4. Tap the Share button (square with arrow pointing up)

5. Scroll down and tap "Add to Home Screen"

6. Give it a name and tap "Add"

7. The app icon will appear on your home screen!

### On Desktop (Chrome/Edge)

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open Chrome or Edge

3. Navigate to `http://localhost:5173`

4. Look for the install icon (⊕) in the address bar, or:
   - Click the three dots menu
   - Select "Install Auto Shop Manager"

5. Click "Install" in the popup

6. The app will open in its own window!

## Production Deployment

For a production PWA, you'll need to:

1. Build the app:
   ```bash
   npm run build
   ```

2. Deploy the `dist` folder to a web hosting service that supports HTTPS:
   - **Netlify**: Drag and drop the `dist` folder
   - **Vercel**: Connect your repository
   - **Firebase Hosting**: Use Firebase CLI
   - **GitHub Pages**: Enable in repository settings

3. **IMPORTANT**: PWAs require HTTPS to work properly (except for localhost)

4. Once deployed, users can install directly from your website URL!

## Testing the PWA

To test PWA features locally:

1. Build the production version:
   ```bash
   npm run build
   ```

2. Serve the built files:
   ```bash
   npx serve dist
   ```

3. Open the provided URL and test installation

## Updating the PWA

When you make changes:

1. Update the `CACHE_NAME` version in `/public/sw.js` (e.g., `'auto-shop-manager-v2'`)
2. Rebuild and redeploy
3. Users will automatically get the update when they reopen the app

## Customization

### Change App Colors
Edit `/public/manifest.json`:
- `theme_color`: Browser address bar color
- `background_color`: Splash screen background

### Change App Name
Edit `/public/manifest.json`:
- `name`: Full app name
- `short_name`: Name shown on home screen

### Change Icons
Replace icon files in `/public/icons/` with your own (maintain the same sizes)

## Troubleshooting

**Install button doesn't appear:**
- Make sure you're using HTTPS (or localhost)
- Check that all required files are present (manifest.json, icons, service worker)
- Clear cache and reload

**Service worker not registering:**
- Check browser console for errors
- Verify `/sw.js` is accessible
- Ensure you're not in private/incognito mode

**Icons not showing:**
- Verify icon files exist in `/public/icons/`
- Check manifest.json paths are correct
- Rebuild the app

## Benefits of PWA vs Native App

- **No App Store**: Install directly from your website
- **Instant Updates**: No need to publish updates through stores
- **Cross-Platform**: One codebase works everywhere
- **Smaller Size**: Much smaller than native apps
- **Easy Sharing**: Just share a URL!

Enjoy your Progressive Web App!
