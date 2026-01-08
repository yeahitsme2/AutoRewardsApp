# Building Mobile Apps with Capacitor

Your app is now configured to build as native Android and iOS applications.

## Prerequisites

### For Android:
- Install [Android Studio](https://developer.android.com/studio)
- Install Java Development Kit (JDK) 17 or higher
- Set up Android SDK through Android Studio

### For iOS (Mac only):
- Install [Xcode](https://apps.apple.com/us/app/xcode/id497799835)
- Install Xcode Command Line Tools: `xcode-select --install`

## Quick Start Commands

### Build and open Android project:
```bash
npm run mobile:android
```

### Build and open iOS project (Mac only):
```bash
npm run mobile:ios
```

### Sync changes after updating web code:
```bash
npm run mobile:sync
```

## Building Android APK

### Option 1: Using Android Studio (Recommended)
1. Run `npm run mobile:android` to open the project in Android Studio
2. Wait for Gradle sync to complete
3. Go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**
4. Once complete, click "locate" to find your APK file
5. The APK will be in: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option 2: Using Command Line
```bash
cd android
./gradlew assembleDebug
```
The APK will be in: `android/app/build/outputs/apk/debug/app-debug.apk`

### For Production Release:
```bash
cd android
./gradlew assembleRelease
```
The APK will be in: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

Note: Production releases need to be signed. See [Android documentation](https://developer.android.com/studio/publish/app-signing) for signing instructions.

## Building iOS App (Mac only)

1. Run `npm run mobile:ios` to open the project in Xcode
2. Select a simulator or connected device
3. Click the Play button to build and run
4. For App Store distribution, go to **Product > Archive**

## Important Notes

### After Making Changes:
Always run `npm run mobile:sync` after updating your web code to copy changes to the mobile projects.

### Environment Variables:
Make sure your `.env` file contains all necessary environment variables. These will be bundled into your app at build time.

### Testing:
- Test thoroughly on real devices, not just emulators
- Check that Supabase connections work on mobile networks
- Verify all features work offline if applicable

### Publishing to App Stores:

#### Google Play Store:
1. Create a signed release APK or App Bundle (AAB recommended)
2. Create a Google Play Developer account ($25 one-time fee)
3. Upload your app through the Play Console
4. Complete the store listing and privacy policy

#### Apple App Store:
1. Join the Apple Developer Program ($99/year)
2. Create an App Store Connect listing
3. Archive and upload through Xcode
4. Submit for review

## Troubleshooting

### Build Errors:
- Make sure all prerequisites are installed
- Run `npx cap sync` to ensure everything is up to date
- Clean the build: In Android Studio, go to **Build > Clean Project**

### App Crashes:
- Check device logs in Android Studio (Logcat) or Xcode (Console)
- Verify all environment variables are set correctly
- Test API connectivity from mobile network

### Changes Not Appearing:
- Always run `npm run build` before syncing
- Clear app data on the device and reinstall

## App Configuration

- **App Name:** Auto Shop Manager
- **Package ID:** com.autoshop.manager
- **Android Project:** `./android/`
- **iOS Project:** `./ios/` (created when you add iOS platform)

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/studio/build/building-cmdline)
- [iOS Developer Guide](https://developer.apple.com/documentation/)
