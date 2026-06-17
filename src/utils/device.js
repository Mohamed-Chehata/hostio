export function getDeviceType() {
  const ua = navigator.userAgent || navigator.vendor || "";
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  const isAndroid = /Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const looksMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || width < 768;

  if (isAndroid) return "android";
  if (isIos) return "iphone";
  return looksMobile ? "mobile" : "desktop";
}

export function isMobileDevice() {
  return getDeviceType() !== "desktop";
}
