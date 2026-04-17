import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DESART — Premium Barbershop",
  description: "Premium barbershop landing page for Desart in Agadir.",
  icons: {
    icon: "/logo.jpg",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gold-bg text-brand-black font-dm-sans text-base leading-[1.65] overflow-x-hidden w-full">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
