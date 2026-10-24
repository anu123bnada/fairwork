import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'ORYQEN — Clarity for Every Opportunity', description: 'A smarter way to evaluate job offers, understand agreements, and build a trusted record of work.', openGraph: {title:'ORYQEN — Clarity for Every Opportunity',description:'Understand opportunities before you commit.',type:'website'} };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html> }
