# 📱 Technula EduFlow — Mobile App (Parent & Student)

Mobile application for parents and students built with **React Native** and **Expo**.
Supports real-time push notifications, attendance, grade report cards, fees, leave requests, bus tracking, daily diary, timetable, and school announcements.

---

## 🚀 Quick Start (Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Local Environment
Create `.env` based on `.env.example`:
```env
# Point to your local backend (use your computer's LAN IP for physical device testing)
EXPO_PUBLIC_API_BASE=http://192.168.1.12:8000
```

### 3. Start Expo Development Server
```bash
npx expo start
```
Scan the QR code with the **Expo Go** app on Android or iOS.

---

## 📦 Building for Production & Google Play Store

This project is configured with **EAS (Expo Application Services)** for automated cloud builds and Google Play Store publishing.

### 1. Install EAS CLI & Log In
```bash
npm install -g eas-cli
eas login
```

### 2. Build Test APK (Install directly on any Android device)
```bash
eas build --platform android --profile preview
```

### 3. Build Production Android App Bundle (.aab for Google Play Store)
```bash
eas build --platform android --profile production
```
- EAS will prompt to generate a new Android keystore on first run — select **Yes**.
- Download the generated `.aab` file once the build finishes.

### 4. Upload to Google Play Console
1. Go to [Google Play Console](https://play.google.com/console).
2. Create App: `Technula EduFlow` (Package: `com.technula.eduflow`).
3. Navigate to **Testing** > **Internal testing** (or Production).
4. Create a new release and upload the `.aab` file.
5. Submit for review!

---

## 🛠️ App Configuration

- **Bundle ID / Package Name**: `com.technula.eduflow`
- **SDK**: Expo 52+ / React Native 0.76+
- **Push Notifications**: Firebase Cloud Messaging (FCM) + Expo Notifications
- **Production API**: `https://eduflow.technula.com/api`
