# APK Build Instructions for Auto Shop Manager

## Prerequisites Checklist

### 1. Required Software
- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **Java Development Kit (JDK)** (v17 recommended) - [Download](https://adoptium.net/)
- **Android Studio** (latest version) - [Download](https://developer.android.com/studio)
- **Git** (for version control) - [Download](https://git-scm.com/)

### 2. Environment Setup
After installing Android Studio:
1. Open Android Studio
2. Go to `Tools` → `SDK Manager`
3. Install:
   - Android SDK Platform 36 (or latest)
   - Android SDK Build-Tools
   - Android SDK Command-line Tools
   - Android SDK Platform-Tools

4. Set environment variables:
   - **Windows**:
     ```
     ANDROID_HOME = C:\Users\YourUsername\AppData\Local\Android\Sdk
     JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17.x.x
     ```
     Add to PATH:
     - `%ANDROID_HOME%\platform-tools`
     - `%ANDROID_HOME%\tools`
     - `%JAVA_HOME%\bin`

   - **Mac/Linux**:
     Add to `~/.bashrc` or `~/.zshrc`:
     ```bash
     export ANDROID_HOME=$HOME/Library/Android/sdk
     export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home
     export PATH=$PATH:$ANDROID_HOME/platform-tools
     export PATH=$PATH:$ANDROID_HOME/tools
     export PATH=$PATH:$JAVA_HOME/bin
     ```

## Pre-Build Verification

Run these commands to verify your setup:

```bash
# Check Node.js
node --version  # Should be v16+

# Check Java
java -version   # Should be version 17

# Check Android SDK
adb --version   # Should show Android Debug Bridge version

# Check Gradle (will download if needed)
cd android
./gradlew --version  # Windows: gradlew.bat --version
cd ..
```

## Build Process

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build the React App
```bash
npm run build
```
This creates optimized production files in the `dist/` folder.

### Step 3: Sync with Capacitor
```bash
npx cap sync android
```
This copies the `dist/` folder to `android/app/src/main/assets/public/`

### Step 4: Build the APK

#### Option A: Using Android Studio (Recommended)
1. Open Android Studio
2. Click `Open an Existing Project`
3. Navigate to and select the `android` folder in this project
4. Wait for Gradle sync to complete (check bottom status bar)
5. Click `Build` → `Build Bundle(s) / APK(s)` → `Build APK(s)`
6. Wait for build to complete (watch bottom right for notifications)
7. Click `locate` in the notification, or find APK at:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

#### Option B: Using Command Line
```bash
cd android
./gradlew assembleDebug
cd ..
```
Windows users: use `gradlew.bat` instead of `./gradlew`

APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Step 5: Build Release APK (for Production)

For a signed release APK:

1. **Create a keystore** (first time only):
   ```bash
   keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```
   Save this file securely and remember the passwords!

2. **Configure signing** - Create `android/keystore.properties`:
   ```properties
   storePassword=YOUR_STORE_PASSWORD
   keyPassword=YOUR_KEY_PASSWORD
   keyAlias=my-key-alias
   storeFile=../my-release-key.keystore
   ```
   **Important**: Add `keystore.properties` to `.gitignore`!

3. **Update** `android/app/build.gradle`:
   Add after `apply plugin: 'com.android.application'`:
   ```gradle
   def keystorePropertiesFile = rootProject.file("keystore.properties")
   def keystoreProperties = new Properties()
   if (keystorePropertiesFile.exists()) {
       keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
   }
   ```

   Update the `android` block:
   ```gradle
   android {
       ...
       signingConfigs {
           release {
               if (keystorePropertiesFile.exists()) {
                   keyAlias keystoreProperties['keyAlias']
                   keyPassword keystoreProperties['keyPassword']
                   storeFile file(keystoreProperties['storeFile'])
                   storePassword keystoreProperties['storePassword']
               }
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled false
               proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

4. **Build release APK**:
   ```bash
   cd android
   ./gradlew assembleRelease
   cd ..
   ```

   APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## Installing the APK

### On Physical Device
1. Enable Developer Options on your Android device:
   - Go to `Settings` → `About Phone`
   - Tap `Build Number` 7 times
2. Enable USB Debugging:
   - Go to `Settings` → `Developer Options`
   - Enable `USB Debugging`
3. Connect device via USB
4. Install:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Using Android Studio
1. Connect device or start emulator
2. Click the green play button (Run)
3. Select your device

### Manual Installation
1. Transfer the APK file to your Android device
2. Open the APK file on the device
3. Allow installation from unknown sources if prompted
4. Install

## Troubleshooting

### Build Fails with "SDK location not found"
Create `android/local.properties`:
```properties
sdk.dir=C:\\Users\\YourUsername\\AppData\\Local\\Android\\Sdk
```
(Use your actual Android SDK path)

### "JAVA_HOME is not set"
Set the JAVA_HOME environment variable (see Environment Setup above)

### Gradle sync fails
1. Delete `android/.gradle` folder
2. Delete `android/build` folder
3. In Android Studio: `File` → `Invalidate Caches and Restart`

### White screen in app
The app requires internet connection to connect to Supabase. Ensure your device has internet access.

### "Missing Supabase environment variables" error
This shouldn't happen as env vars are embedded during build. If it does:
1. Verify `.env` file exists in project root
2. Run `npm run build` again
3. Run `npx cap sync android` again

## Quick Build Script

Save this as `build-apk.sh` (Mac/Linux) or `build-apk.bat` (Windows):

**build-apk.sh:**
```bash
#!/bin/bash
echo "Building Auto Shop Manager APK..."
npm run build && \
npx cap sync android && \
cd android && \
./gradlew assembleDebug && \
cd .. && \
echo "✓ Build complete!" && \
echo "APK: android/app/build/outputs/apk/debug/app-debug.apk"
```

**build-apk.bat:**
```batch
@echo off
echo Building Auto Shop Manager APK...
call npm run build
call npx cap sync android
cd android
call gradlew.bat assembleDebug
cd ..
echo Build complete!
echo APK: android\app\build\outputs\apk\debug\app-debug.apk
```

Make executable (Mac/Linux): `chmod +x build-apk.sh`

Run: `./build-apk.sh` (Mac/Linux) or `build-apk.bat` (Windows)

## Project Configuration Summary

### Key Files Verified
- ✅ `capacitor.config.ts` - Capacitor configuration
- ✅ `vite.config.ts` - Build configuration with `base: './'`
- ✅ `android/app/build.gradle` - Android build configuration
- ✅ `android/variables.gradle` - SDK versions (minSdk: 24, targetSdk: 36)
- ✅ `.env` - Supabase credentials (properly ignored in git)
- ✅ `MainActivity.java` - Extends BridgeActivity correctly

### Build Output
- React app builds to `dist/` folder
- Environment variables are embedded at build time
- Capacitor syncs to `android/app/src/main/assets/public/`
- APK includes all React code and assets

## Common Commands Reference

```bash
# Development
npm run dev                    # Start dev server (web only)
npm run build                  # Build production files
npm run typecheck             # Check TypeScript

# Mobile
npx cap sync android          # Sync web build to Android
npx cap open android          # Open in Android Studio
npm run mobile:android        # Build + sync + open Android Studio

# Android Build
cd android
./gradlew assembleDebug       # Build debug APK
./gradlew assembleRelease     # Build release APK
./gradlew clean               # Clean build artifacts
./gradlew --info assembleDebug # Build with detailed logs
cd ..

# Install & Run
adb devices                   # List connected devices
adb install path/to/app.apk  # Install APK
adb uninstall com.autoshop.manager  # Uninstall app
adb logcat                    # View Android logs
```

## Support

If you encounter issues:
1. Check you have all prerequisites installed
2. Verify environment variables are set
3. Try cleaning and rebuilding:
   ```bash
   cd android
   ./gradlew clean
   cd ..
   rm -rf dist node_modules android/app/build
   npm install
   npm run build
   npx cap sync android
   ```
4. Check Android Studio's Build panel for specific errors
