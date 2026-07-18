import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orchestra — AI automation studio",
  description:
    "Describe an automation in plain English. The AI plans it, asks for exactly the credentials it needs, and runs it.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
