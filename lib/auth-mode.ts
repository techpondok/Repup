export const liveAuthEnabled = () => process.env.APP_LIVE_AUTH_ENABLED === "true";
export const liveAuthUnavailable = "Login akun belum tersedia. Anda dapat mencoba mode demo.";
export const isAuthCookie = (name: string) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name);
