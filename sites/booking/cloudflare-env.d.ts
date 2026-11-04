declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    YANDEX_DISK_OAUTH_TOKEN?: string;
    YANDEX_BACKUP_FOLDER?: string;
    BOOKING_NOTIFY_ENDPOINT?: string;
    BOOKING_NOTIFY_TOKEN?: string;
    BOOKING_TELEGRAM_CHAT_ID?: string;
    BUCKET?: R2Bucket;
  }
}
