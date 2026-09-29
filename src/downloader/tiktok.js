// تعريف منصة TikTok — يدعم الفيديوهات العامة فقط
// yt-dlp يختار تلقائيًا النسخة بدون علامة مائية عند توفرها من المصدر.
export const tiktok = {
  id: "tiktok",
  label: "TikTok",
  matches: (url) =>
    /^(https?:\/\/)?(www\.|m\.|vm\.|vt\.)?tiktok\.com\/\S+/i.test(url),
  ydlOptions: ["--no-playlist"],
};