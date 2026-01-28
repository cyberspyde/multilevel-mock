import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bestcenter Multilevel Mock",
  description: "AI-powered mock exam platform for speaking and writing assessments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F2F2F7] antialiased">
        {children}
      </body>
    </html>
  );
}
