import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3001"),
  title: "Comentix",
  description: "Experience the ultimate YouTube comment battle. Last valid comment wins the prize!",
  openGraph: {
    title: "Comentix - Last Comment Wins",
    description: "The most intense live YouTube battle. One comment to rule them all.",
    images: ["/og-image.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Comentix - YouTube Battle",
    description: "Battle for the last comment live on YouTube!",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="bg-decoration">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
        </div>
        {children}
      </body>
    </html>
  );
}
