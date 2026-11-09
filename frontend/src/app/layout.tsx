import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VEGAH — Enterprise Document Intelligence & Compliance Agent",
  description: "MCP-powered enterprise compliance agent with Obsidian-style knowledge vault and near-zero cost architecture",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
