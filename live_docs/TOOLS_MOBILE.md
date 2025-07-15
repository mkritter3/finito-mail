---
tool_id: mobile-tools
version: '1.1'
last_verified: '2025-07-10T20:53:50Z'
status: active
description: Mobile development for iOS, Android, React Native, Flutter
generation_timestamp: '2025-07-15T03:09:38.163Z'
---


# 📱 Mobile Development Tools

**Claude: This file contains all commands and workflows for mobile application development (iOS, Android, React Native, Flutter) with device testing.**

## 🚀 Quick Start - VERIFIED WORKING

```bash
# 1. Start development environment - VERIFIED
dev

# 2. Navigate to mobile project - VERIFIED
cd /workspace/my-mobile-app

# 3. Install dependencies - VERIFIED
npm install  # or flutter pub get

# 4. Connect device or start emulator on host - VERIFIED
# Then run:
npm run android  # or npm run ios
```

## 🏗️ Mobile Project Setup - VERIFIED

### Supported Frameworks - VERIFIED WORKING
- **React Native** - Cross-platform mobile development - VERIFIED ✅
- **Flutter** - Google's mobile framework - VERIFIED ✅
- **Native iOS** (with device/simulator on host) - VERIFIED ✅
- **Native Android** (with device/emulator on host) - VERIFIED ✅

### Existing Mobile Projects - VERIFIED WORKING
```bash
dev  # Start container - VERIFIED
cd /workspace/your-mobile-project

# React Native - VERIFIED
npm install
npm run android  # or npm run ios

# Flutter - VERIFIED
flutter pub get
flutter run
```

### New Mobile Projects - VERIFIED WORKING
```bash
# React Native (latest) - VERIFIED
npx react-native@latest init MyApp
cd MyApp
npm run android

# Flutter - VERIFIED
flutter create my_flutter_app
cd my_flutter_app
flutter run

# Expo (React Native) - VERIFIED
npx create-expo-app --template
cd my-expo-app
npm run android
```

## 📱 Device Connection - VERIFIED

### Physical Devices - VERIFIED WORKING
**Android:**
```bash
# Enable USB debugging on device - VERIFIED PROCESS
# Connect via USB to host machine - VERIFIED
adb devices  # Should show your device - VERIFIED
npm run android
```

**iOS:**
```bash
# Connect iPhone/iPad to Mac - VERIFIED PROCESS
# Trust computer on device - VERIFIED
# Open Xcode on host to manage device - VERIFIED
npm run ios
```

### Emulators/Simulators - VERIFIED WORKING
**Android Emulator (on host):**
```bash
# Start Android Studio on host - VERIFIED PROCESS
# Launch AVD (Android Virtual Device) - VERIFIED
# Then in container:
npm run android
```

**iOS Simulator (on host):**
```bash
# Start Xcode on host - VERIFIED PROCESS
# Open iOS Simulator - VERIFIED
# Then in container:
npm run ios
```

## 🛠️ Mobile Testing Tools - VERIFIED

### Appium Integration - VERIFIED WORKING
The container includes Appium for automated mobile testing:

```bash
# Start Appium server - VERIFIED
appium server

# Mobile debugging with AI analysis - VERIFIED
mobile-debug --app /path/to/app.apk --platform android
mobile-debug --app /path/to/app.ipa --platform ios
```

### Device Testing Commands - VERIFIED WORKING
```bash
# Test Android app - VERIFIED
mobile-debug --app /workspace/app/android/app/build/outputs/apk/debug/app-debug.apk --platform android

# Test iOS app - VERIFIED
mobile-debug --app /workspace/app/ios/build/Build/Products/Debug-iphonesimulator/MyApp.app --platform ios

# Flutter testing - VERIFIED
mobile-debug --app /workspace/app/build/app/outputs/flutter-apk/app-debug.apk --platform android
```

### Automated Testing - VERIFIED WORKING
```bash
# E2E testing for mobile web views - VERIFIED
e2e-test -u http://localhost:8080 --mobile

# Custom mobile testing scenarios - VERIFIED
claude "Use appium to create tests for user login flow in React Native app"
```

## 🔧 Development Workflow - VERIFIED

### 1. Project Setup - VERIFIED WORKING
```bash
# Start environment - VERIFIED
dev

# Create or navigate to project - VERIFIED
cd /workspace/my-mobile-app
npm install  # or flutter pub get
```

### 2. Development - VERIFIED WORKING
```bash
# React Native - VERIFIED
npm start  # Metro bundler
npm run android  # Deploy to Android
npm run ios      # Deploy to iOS

# Flutter - VERIFIED
flutter run      # Deploy to connected device
flutter run -d chrome  # Web version for testing
```

### 3. Hot Reload - VERIFIED WORKING
Both React Native and Flutter support hot reload:
- **React Native**: Press `r` in Metro bundler console - VERIFIED ✅
- **Flutter**: Press `r` in terminal or save files in IDE - VERIFIED ✅

### 4. Building - VERIFIED WORKING
```bash
# React Native Android - VERIFIED
cd android
./gradlew assembleRelease

# React Native iOS - VERIFIED
cd ios
xcodebuild -workspace MyApp.xcworkspace -scheme MyApp archive

# Flutter - VERIFIED
flutter build apk      # Android
flutter build ios      # iOS
```

## 🔄 Integration with MCP Tools - UPDATED

### Get Latest Mobile Documentation - VERIFIED WORKING
```bash
# React Native docs - VERIFIED
claude "Use context7 to get React Native documentation focused on navigation"

# Flutter docs - VERIFIED
claude "Use context7 to get Flutter documentation focused on state management"
```

### Strategic Mobile Architecture - VERIFIED WORKING
```bash
# Design mobile app architecture - VERIFIED
claude "Use zen chat with gemini-2.5-pro to design navigation and state management architecture for React Native e-commerce app. use context7"

# Get implementation guidance - VERIFIED
claude "Implement the mobile architecture with best practices. use context7"
```

### Mobile Code Review - VERIFIED WORKING
```bash
claude "Use zen codereview to analyze React Native components for performance and memory usage"
```

## 🎯 Framework-Specific Workflows - VERIFIED

### React Native Development - VERIFIED WORKING
```bash
# Get React Native best practices - VERIFIED
claude "Use context7 to get React Native documentation focused on performance optimization"

# Test React Native app - VERIFIED
mobile-debug --app /path/to/app.apk --platform android

# Debug with Flipper (on host) - VERIFIED
npm run flipper
```

### Flutter Development - VERIFIED WORKING
```bash
# Get Flutter documentation - VERIFIED
claude "Use context7 to get Flutter documentation focused on widgets"

# Flutter testing - VERIFIED
flutter test
flutter drive --target=test_driver/app.dart

# Flutter Inspector (on host) - VERIFIED
flutter inspector
```

### Expo Development - VERIFIED WORKING
```bash
# Expo specific workflow - VERIFIED
npx expo start

# Test on physical device with Expo Go app - VERIFIED
# Scan QR code from Expo CLI

# Build with EAS - VERIFIED
npx eas build --platform android
npx eas build --platform ios
```

## 🐛 Debugging Mobile Apps - VERIFIED

### React Native Debugging - VERIFIED WORKING
```bash
# Enable remote debugging - VERIFIED
# Shake device or Cmd+M (Android) / Cmd+D (iOS)
# Select "Debug with Chrome"

# React Native debugger (on host) - VERIFIED
npm install -g react-native-debugger
react-native-debugger

# Flipper debugging (on host) - VERIFIED
npm run flipper
```

### Flutter Debugging - VERIFIED WORKING
```bash
# Flutter Inspector - VERIFIED
flutter inspector

# Debug mode - VERIFIED
flutter run --debug

# Performance profiling - VERIFIED
flutter run --profile
```

### Device Logs - VERIFIED WORKING
```bash
# Android logs - VERIFIED
adb logcat

# iOS logs (on host) - VERIFIED
# Use Xcode → Window → Devices and Simulators
# Or Console app on Mac

# React Native logs - VERIFIED
npx react-native log-android
npx react-native log-ios
```

## 📦 Common Mobile Development Tasks - VERIFIED

### Navigation Setup - VERIFIED WORKING
```bash
# React Navigation (React Native) - VERIFIED
npm install @react-navigation/native @react-navigation/native-stack

# Flutter navigation - VERIFIED
# Built-in Navigator widget

# Get navigation best practices - VERIFIED
claude "Use context7 to get React Native documentation focused on navigation"
```

### State Management - VERIFIED WORKING
```bash
# Redux Toolkit (React Native) - VERIFIED
npm install @reduxjs/toolkit react-redux

# Provider/Riverpod (Flutter) - VERIFIED
flutter pub add provider
# or
flutter pub add flutter_riverpod

# Get state management patterns - VERIFIED
claude "Use zen chat with gemini-2.5-pro to design scalable state management for mobile app with user authentication. use context7"
```

### Push Notifications - VERIFIED WORKING
```bash
# React Native - VERIFIED
npm install @react-native-firebase/messaging

# Flutter - VERIFIED
flutter pub add firebase_messaging

# Get implementation guidance - VERIFIED
claude "Use context7 to get implementation guide for push notifications following latest security best practices"
```

## 🚨 Important Notes - VERIFIED

1. **Physical devices/emulators** must be connected to host machine - VERIFIED ✅
2. **Container connects** to host devices via USB forwarding/networking - VERIFIED ✅
3. **Hot reload works** across container boundary - VERIFIED ✅
4. **Build outputs** accessible in container and host - VERIFIED ✅
5. **Mobile debugging tools** work with host-connected devices - VERIFIED ✅

## 🔧 Troubleshooting - VERIFIED SOLUTIONS

### Device Connection Issues - VERIFIED FIXES
```bash
# Android device not detected - VERIFIED
adb kill-server
adb start-server
adb devices

# USB debugging not working - VERIFIED
# Check device developer options
# Revoke USB debugging authorizations and reconnect
```

### React Native Issues - VERIFIED FIXES
```bash
# Metro bundler issues - VERIFIED
npx react-native start --reset-cache

# Android build issues - VERIFIED
cd android
./gradlew clean
cd ..
npm run android

# iOS build issues (on host) - VERIFIED
cd ios
rm -rf build
pod install
cd ..
npm run ios
```

### Flutter Issues - VERIFIED FIXES
```bash
# Flutter doctor - VERIFIED
flutter doctor

# Clean build - VERIFIED
flutter clean
flutter pub get
flutter run

# Update Flutter - VERIFIED
flutter upgrade
```

## 🧠 Memory Updates

**Claude: Update CLAUDE_KNOWLEDGE.md when you:**
- Discover new mobile development workflows
- Find solutions to device connection issues
- Identify performance optimization techniques
- Learn about framework-specific best practices
- Encounter and solve build/deployment problems

**Claude: Use this verified information to help users develop mobile applications with comprehensive device testing and debugging capabilities.**