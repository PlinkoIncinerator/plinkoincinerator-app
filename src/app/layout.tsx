import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientWrapper from "./components/clientwrapper";
import Script from "next/script";
import GoogleAnalytics from "./components/GoogleAnalytics";
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PlinkoIncinerator | Burn Solana Dust & Win Big 🔥",
  description: "Turn worthless token accounts into SOL, then YOLO it on Plinko! Clean your wallet, earn SOL, go degen mode.",
  keywords: "solana, token burn, empty accounts, plinko, crypto gambling, nft burn, solana dapp, degen, crypto casino",
  authors: [{ name: "PlinkoIncinerator Team" }],
  openGraph: {
    title: "PlinkoIncinerator | Burn Token Trash, Win SOL Cash 🚀",
    description: "Your Solana wallet is cluttered with empty token accounts? Turn that trash into SOL, then gamble it for 25x gains!",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "PlinkoIncinerator | Burn & Earn",
    description: "Burn empty Solana tokens, get SOL, play Plinko, lambo soon 🚀",
  },
  robots: "index, follow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Analytics */}
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=G-KNZ740QZ04`}
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-KNZ740QZ04', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ClientWrapper>
          <Suspense fallback={null}>
            <GoogleAnalytics />
          </Suspense>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
} 