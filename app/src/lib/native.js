/**
 * Native bridge — wraps Capacitor plugins with graceful web fallbacks.
 * Import from here instead of @capacitor/* directly so the PWA keeps working.
 */
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

// ── Push Notifications ─────────────────────────────────────────────────────
let PushNotifications = null;

export async function initPushNotifications(onToken, onNotification) {
  if (!isNative) return;
  if (!PushNotifications) {
    const mod = await import('@capacitor/push-notifications');
    PushNotifications = mod.PushNotifications;
  }

  const permission = await PushNotifications.requestPermissions();
  if (permission.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', (token) => {
    console.log('[Push] Token:', token.value);
    if (onToken) onToken(token.value);
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('[Push] Registration error:', err);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('[Push] Received:', notification);
    if (onNotification) onNotification(notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[Push] Action:', action);
  });
}

// ── Geolocation ────────────────────────────────────────────────────────────
let Geolocation = null;

export async function getCurrentPosition(opts = {}) {
  if (isNative) {
    if (!Geolocation) {
      const mod = await import('@capacitor/geolocation');
      Geolocation = mod.Geolocation;
    }
    const perm = await Geolocation.requestPermissions();
    if (perm.location === 'denied') throw new Error('Location permission denied');
    return Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      ...opts,
    });
  }
  // Web fallback
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy } }),
      reject,
      { enableHighAccuracy: true, timeout: 10000, ...opts }
    );
  });
}

// ── Camera ─────────────────────────────────────────────────────────────────
let Camera = null;

export async function takePhoto() {
  if (isNative) {
    if (!Camera) {
      const mod = await import('@capacitor/camera');
      Camera = mod.Camera;
    }
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: 'uri',
      source: 'camera',
      width: 1200,
      height: 1200,
    });
    return photo;
  }
  // Web fallback — use file input
  return null;
}

export async function pickPhoto() {
  if (isNative) {
    if (!Camera) {
      const mod = await import('@capacitor/camera');
      Camera = mod.Camera;
    }
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: 'uri',
      source: 'photos',
      width: 1200,
      height: 1200,
    });
    return photo;
  }
  return null;
}

// ── Haptics ────────────────────────────────────────────────────────────────
let Haptics = null;

export async function hapticFeedback(style = 'Medium') {
  if (!isNative) return;
  if (!Haptics) {
    const mod = await import('@capacitor/haptics');
    Haptics = mod.Haptics;
  }
  await Haptics.impact({ style });
}

export async function hapticNotification(type = 'Success') {
  if (!isNative) return;
  if (!Haptics) {
    const mod = await import('@capacitor/haptics');
    Haptics = mod.Haptics;
  }
  await Haptics.notification({ type });
}

// ── Status Bar ─────────────────────────────────────────────────────────────
let StatusBar = null;

export async function setStatusBarDark() {
  if (!isNative) return;
  if (!StatusBar) {
    const mod = await import('@capacitor/status-bar');
    StatusBar = mod.StatusBar;
  }
  await StatusBar.setStyle({ style: 'DARK' });
  await StatusBar.setBackgroundColor({ color: '#0b1222' });
}

// ── Network ────────────────────────────────────────────────────────────────
let Network = null;

export async function getNetworkStatus() {
  if (!Network) {
    const mod = await import('@capacitor/network');
    Network = mod.Network;
  }
  return Network.getStatus();
}

export async function onNetworkChange(callback) {
  if (!Network) {
    const mod = await import('@capacitor/network');
    Network = mod.Network;
  }
  return Network.addListener('networkStatusChange', callback);
}

// ── App lifecycle ──────────────────────────────────────────────────────────
let App = null;

export async function onAppStateChange(callback) {
  if (!isNative) return;
  if (!App) {
    const mod = await import('@capacitor/app');
    App = mod.App;
  }
  App.addListener('appStateChange', callback);
}

// ── Keyboard ───────────────────────────────────────────────────────────────
let Keyboard = null;

export async function hideKeyboard() {
  if (!isNative) return;
  if (!Keyboard) {
    const mod = await import('@capacitor/keyboard');
    Keyboard = mod.Keyboard;
  }
  await Keyboard.hide();
}
