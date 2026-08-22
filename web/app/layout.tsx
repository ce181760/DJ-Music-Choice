import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DJ Music Choice Assist",
  description: "Build an event-ready DJ music plan.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}