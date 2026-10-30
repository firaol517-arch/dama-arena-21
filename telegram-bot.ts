/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone Telegram Bot for DAMA ARENA.
 * Run with: npx tsx telegram-bot.ts
 * Requires TELEGRAM_BOT_TOKEN in .env or environment.
 */

import dotenv from 'dotenv';
dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

if (!BOT_TOKEN || BOT_TOKEN === 'MY_TELEGRAM_BOT_TOKEN') {
  console.log(`
======================================================================
DAMA ARENA TELEGRAM BOT SETUP
======================================================================
No valid TELEGRAM_BOT_TOKEN found in .env.
To activate the live Telegram Bot:
1. Create a bot with @BotFather on Telegram (https://t.me/botfather).
2. Set TELEGRAM_BOT_TOKEN="your_token_here" in your environment or .env.
3. In @BotFather, configure the Web App URL pointing to:
   ${APP_URL}
======================================================================
`);
}

/**
 * Standard Telegram Bot API helper using fetch
 */
export async function sendTelegramMessage(chatId: number | string, text: string, replyMarkup?: object) {
  if (!BOT_TOKEN) return;
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
  }
}

/**
 * Build Dama Arena Inline Keyboards linking directly to the WebApp
 */
export function buildMainMenuKeyboard(appUrl: string = APP_URL) {
  return {
    inline_keyboard: [
      [
        {
          text: '⚔️ Play Dama Arena',
          web_app: { url: `${appUrl}?tgWebAppStartParam=play` },
        },
      ],
      [
        {
          text: '🤖 Play vs AI',
          web_app: { url: `${appUrl}?mode=ai` },
        },
        {
          text: '👥 Play with Friend',
          web_app: { url: `${appUrl}?mode=friend` },
        },
      ],
      [
        {
          text: '🌐 Online Multiplayer',
          web_app: { url: `${appUrl}?mode=multiplayer` },
        },
        {
          text: '🏆 Leaderboard',
          web_app: { url: `${appUrl}?mode=leaderboard` },
        },
      ],
      [
        {
          text: '👤 My Profile',
          web_app: { url: `${appUrl}?mode=profile` },
        },
        {
          text: '📜 Game Rules',
          web_app: { url: `${appUrl}?mode=rules` },
        },
      ],
    ],
  };
}

/**
 * Handle incoming Telegram Update
 */
export async function handleTelegramUpdate(update: any) {
  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const userName = message.from?.first_name || 'Champion';

  if (text.startsWith('/start')) {
    // Check if deep linked (e.g. /start join_ROOM123)
    const parts = text.split(' ');
    const deepParam = parts.length > 1 ? parts[1] : '';
    const launchUrl = deepParam ? `${APP_URL}?tgWebAppStartParam=${deepParam}` : APP_URL;

    const welcomeMsg = `<b>Welcome to DAMA ARENA, ${userName}!</b> 🇪🇹👑\n\nPlay authentic Ethiopian Dama, challenge tactical AI, and compete with friends in real-time matches.\n\nTap below to launch the arena!`;

    const keyboard = deepParam
      ? {
          inline_keyboard: [
            [{ text: '⚡ Join Room Now', web_app: { url: launchUrl } }],
            ...buildMainMenuKeyboard(APP_URL).inline_keyboard,
          ],
        }
      : buildMainMenuKeyboard(APP_URL);

    await sendTelegramMessage(chatId, welcomeMsg, keyboard);
  } else if (text === '/rules') {
    const rulesMsg = `<b>Ethiopian Dama Rules Overview:</b>\n\n• <b>10x10 Board:</b> Played on dark squares.\n• <b>Ordinary Pieces:</b> Move 1 square diagonally forward OR backward. Captures jump adjacent enemy piece forward or backward into empty square.\n• <b>Mandatory Captures:</b> Any available capture must be taken. Multi-captures are mandatory.\n• <b>Free Route Choice:</b> Max captures is NOT mandatory; choose any legal route!\n• <b>Immediate Promotion:</b> Reaching farthest row promotes immediately. Even mid-sequence, piece promotes and continues as King!\n• <b>Flying Kings:</b> Long-range movement and capture over diagonals.`;
    await sendTelegramMessage(chatId, rulesMsg, buildMainMenuKeyboard(APP_URL));
  } else if (text === '/play') {
    await sendTelegramMessage(chatId, `Ready for battle? Tap below to jump straight into a match!`, buildMainMenuKeyboard(APP_URL));
  } else if (text === '/profile') {
    await sendTelegramMessage(chatId, `View your ELO rating, level, badges, and win streak inside the app:`, buildMainMenuKeyboard(APP_URL));
  } else if (text === '/leaderboard') {
    await sendTelegramMessage(chatId, `See where you rank against the top Ethiopian Dama grandmasters:`, buildMainMenuKeyboard(APP_URL));
  } else if (text === '/help') {
    const helpMsg = `<b>Dama Arena Commands:</b>\n/start - Open main menu & game\n/play - Start a match\n/rules - Ethiopian Dama official rules\n/profile - Check your profile & stats\n/leaderboard - Top ranked players\n/help - Show this guide`;
    await sendTelegramMessage(chatId, helpMsg, buildMainMenuKeyboard(APP_URL));
  }
}

// Long-polling worker if executed directly as daemon
if (BOT_TOKEN && BOT_TOKEN !== 'MY_TELEGRAM_BOT_TOKEN') {
  console.log('Starting Telegram Bot Polling...');
  let offset = 0;

  async function poll() {
    try {
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await handleTelegramUpdate(update);
        }
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
    setTimeout(poll, 1000);
  }

  poll();
}
