import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "ORYQEN", short_name: "ORYQEN", lang: "en",
    description: "Understand offers, clarify agreements and keep a private work record.",
    start_url: "/", scope: "/", display: "standalone",
    background_color: "#eaf0ff", theme_color: "#0b1b33",
    icons: [192, 512].map(size => ({ src: `/oryqen/restored-icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })),
  };
}
