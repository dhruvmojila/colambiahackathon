import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata = {
  title: "SignPulse AI — Real-time Sign Language Translation",
  description:
    "A vision-enabled Live Agent that translates sign language into context-aware, emotive, multilingual speech. Powered by Google ADK & Gemini.",
  keywords: [
    "sign language",
    "AI",
    "accessibility",
    "real-time translation",
    "Gemini",
    "Google ADK",
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
