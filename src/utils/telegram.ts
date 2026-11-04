/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  const tg = (window as any).Telegram?.WebApp;
  return Boolean(tg && (tg.initData || tg.initDataUnsafe?.user));
}

export function getTelegramWebApp() {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    return (window as any).Telegram.WebApp;
  }
  return null;
}

export function getTelegramUser(): TelegramUser | null {
  const tg = getTelegramWebApp();
  return tg?.initDataUnsafe?.user || null;
}

export function initTelegramUI() {
  const tg = getTelegramWebApp();
  if (!tg) return;

  try {
    tg.ready();
    tg.expand();
    // Set header color to match dark luxury theme
    if (tg.setHeaderColor) {
      tg.setHeaderColor('#0B0E14');
    }
    if (tg.setBackgroundColor) {
      tg.setBackgroundColor('#0B0E14');
    }
  } catch (err) {
    console.warn('Telegram WebApp init error:', err);
  }
}

export function getTelegramInitData(): string {
  const tg = getTelegramWebApp();
  return tg?.initData || '';
}

export function getTelegramStartParam(): string | null {
  const tg = getTelegramWebApp();
  if (tg?.initDataUnsafe?.start_param) {
    return tg.initDataUnsafe.start_param;
  }
  // Fallback to URL query parameter
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('tgWebAppStartParam') || params.get('mode') || params.get('room') || null;
  }
  return null;
}

export function openTelegramExternalLink(url: string) {
  if (typeof window === 'undefined') return;
  const tg = getTelegramWebApp();
  if (tg && typeof tg.openLink === 'function') {
    tg.openLink(url);
    return;
  }
  // Safe browser fallback: never set window.location.href to custom schemes!
  window.open(url, '_blank', 'noopener,noreferrer');
}
