import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Baobae Live Voting",
  description: "Mobile-first audience voting and live production controls for Baobae.",
  icons: {
    icon: "/contestants/ctc.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

