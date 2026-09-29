// تعريف منصة Instagram — المحتوى العام فقط (Reels / Posts / Videos)
// لا محاولة لتجاوز الحسابات الخاصة أو القيود الأمنية.
export const instagram = {
  id: "instagram",
  label: "Instagram",
  matches: (url) =>
    /^(https?:\/\/)?(www\.)?instagram\.com\/(reel|reels|p|tv)\/\S+/i.test(url),
  ydlOptions: ["--no-playlist"],
};