// Appearance only. No account data or credentials are stored here.
try {
  const preference = localStorage.getItem("oryqen.appearance");
  if (preference === "light" || preference === "dark") document.documentElement.dataset.theme = preference;
} catch { /* System appearance remains usable when storage is unavailable. */ }
