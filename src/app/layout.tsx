import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Vesper — Confidential Wrapper Registry",
  description: "Wrap, unwrap, and decrypt ERC-7984 confidential tokens on Sepolia. Powered by Zama FHE.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
