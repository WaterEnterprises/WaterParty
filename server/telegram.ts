import { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } from "./config";

export const sendTelegramMessage = async (message: string) => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const result = await response.json();
    console.log("Telegram API response:", result);
  } catch (error) {
    console.error("Failed to send telegram message:", error);
  }
};
