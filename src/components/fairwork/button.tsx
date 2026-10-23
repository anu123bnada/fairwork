import type { ButtonHTMLAttributes } from "react";

// Semantic primitive only. The full Figma button asset/style is integrated with
// its first product screen; no approximate replacement gradient is invented.
export function Button({ type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} {...props} />;
}
