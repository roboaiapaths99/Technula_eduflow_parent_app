/**
 * Push Notification Service for SchoolOS Parent App
 * Handles:
 * - Immediate Notification Channel creation with MAX importance (heads-up banner + ringtone like Zomato)
 * - Permission requests
 * - Device push token registration with backend (Expo Push + Firebase FCM)
 * - Foreground notification presentation
 * - Notification response listeners (tap navigation)
 * - Local heads-up notification trigger
 */
import { Platform, Vibration } from 'react-native';
import { parentApi } from '../api';

let Notifications = null;
let Device = null;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');
} catch (e) {
  console.log('[Push Notification] expo-notifications / expo-device not loaded');
}

// 1. Configure foreground banner behavior for MAX priority heads-up
if (Notifications && Notifications.setNotificationHandler) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  });
}

/**
 * Ensure the Android Notification Channel exists with MAX importance for heads-up alerts.
 */
export async function setupAndroidNotificationChannel() {
  if (Platform.OS === 'android' && Notifications && Notifications.setNotificationChannelAsync) {
    try {
      await Notifications.setNotificationChannelAsync('schoolos_alerts', {
        name: 'School Alerts & Notices',
        description: 'Urgent announcements, circulars, and attendance alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4F46E5',
        sound: 'default',
        enableLights: true,
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });
      console.log('[Push Notification] Android channel "schoolos_alerts" initialized with MAX priority');
    } catch (e) {
      console.warn('[Push Notification] Failed to configure Android channel:', e);
    }
  }
}

// Call channel setup on script load
setupAndroidNotificationChannel();

/**
 * Register device with backend for push notifications
 * @returns {Promise<string|null>} The registered device token or null
 */
export async function registerForPushNotificationsAsync() {
  await setupAndroidNotificationChannel();

  if (!Notifications) {
    console.log('[Push Notification] Notifications module unavailable.');
    return null;
  }

  let token = null;

  try {
    // Check & request notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push Notification] Permissions not granted by user.');
    }

    // Try obtaining Expo Push Token (works in Expo Go & development client)
    try {
      const expoRes = await Notifications.getExpoPushTokenAsync().catch(() => null);
      if (expoRes?.data) {
        token = expoRes.data;
      }
    } catch (_) {}

    // Fallback to native FCM device push token if Expo token not returned
    if (!token) {
      try {
        const deviceRes = await Notifications.getDevicePushTokenAsync().catch(() => null);
        if (deviceRes?.data) {
          token = deviceRes.data;
        }
      } catch (_) {}
    }

    // Fallback for web or emulator testing
    if (!token) {
      token = `device_client_${Platform.OS}_${Date.now()}`;
    }

    if (token) {
      await parentApi.registerDeviceToken(token);
      console.log('[Push Notification] Device registered with backend token:', token.slice(0, 25) + '...');
    }
  } catch (err) {
    console.error('[Push Notification] Registration error:', err);
  }

  return token;
}

/**
 * Trigger an immediate native heads-up notification (drops down from top with ringtone).
 * @param {Object} params - { title, body, data }
 */
export async function triggerLocalHeadsUpNotification({ title, body, data = {}, delaySeconds = 0 }) {
  await setupAndroidNotificationChannel();
  try {
    // Haptic vibration feedback
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 250, 250, 250]);
    }

    if (Notifications && Notifications.scheduleNotificationAsync) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: title || '🔔 School Test Alert',
          body: body || 'New announcement from SchoolOS.',
          data: data,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          vibrate: [0, 250, 250, 250],
          channelId: 'schoolos_alerts',
        },
        trigger: delaySeconds > 0 ? { seconds: delaySeconds } : null,
      });
      console.log(`[Push Notification] Native heads-up notification ${delaySeconds > 0 ? `scheduled for ${delaySeconds}s` : 'triggered immediately'}`);
    }
  } catch (e) {
    console.warn('[Push Notification] Could not trigger local heads-up:', e);
  }
}

/**
 * Set up listeners for received notifications and tap actions
 * @param {Function} onNotificationReceived Callback when alert arrives
 * @param {Function} onNotificationTapped Callback when user taps banner
 * @returns {Function} Cleanup subscription function
 */
export function setupNotificationListeners(onNotificationReceived, onNotificationTapped) {
  if (!Notifications) return () => {};

  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    if (onNotificationReceived) {
      onNotificationReceived(notification);
    }
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    if (onNotificationTapped) {
      const data = response?.notification?.request?.content?.data || {};
      onNotificationTapped(data);
    }
  });

  return () => {
    if (receivedSub) Notifications.removeNotificationSubscription(receivedSub);
    if (responseSub) Notifications.removeNotificationSubscription(responseSub);
  };
}
