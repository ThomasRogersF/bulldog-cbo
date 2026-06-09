// Shared Telegram sender. Posts an HTML message to the Bot API.

const TELEGRAM_API = 'https://api.telegram.org'

export interface TelegramConfig {
  botToken: string
  chatId: string
}

export async function sendTelegram(
  config: TelegramConfig,
  message: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${TELEGRAM_API}/bot${config.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    )
    const data = await res.json()
    if (!data.ok) {
      return { ok: false, error: data.description }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
