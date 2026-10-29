// Applies the saved appearance before first paint on every route (loaded synchronously in <head>).
try { var v = localStorage.getItem("oryqen.appearance"); document.documentElement.dataset.theme = v === "light" || v === "dark" ? v : "system"; } catch { document.documentElement.dataset.theme = "system"; }
