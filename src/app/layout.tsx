import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexus Financial - AI Customer Service Platform',
  description: 'Enterprise AI-powered customer service for financial services',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%230f1629'/><text y='22' x='6' font-size='18' fill='%2314b8a6'>N</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
