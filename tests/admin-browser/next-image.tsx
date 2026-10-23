import type {ImgHTMLAttributes} from "react";
// Only the isolated Vite harness lacks Next's image runtime. Production uses Next.
export default function Image({unoptimized,...props}:ImgHTMLAttributes<HTMLImageElement>&{unoptimized?:boolean}){void unoptimized;return <img {...props} alt={props.alt??""}/>;}
