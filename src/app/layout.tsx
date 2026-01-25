import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WebviewProvider } from "@/components/providers/WebviewProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Monoid - Code Graph Visualization",
  description: "Visualize your codebase as an interactive dependency graph",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WebviewProvider>
          {children}
        </WebviewProvider>
      </body>
    </html>
  );
}
