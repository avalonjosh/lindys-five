/** The Ko-fi page behind "Support Lindy's Five". Unset = every support link is hidden and /support 404s. */
export const KOFI_URL = process.env.NEXT_PUBLIC_KOFI_URL || '';
export const supportEnabled = KOFI_URL !== '';
