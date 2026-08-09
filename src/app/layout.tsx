import type { Metadata, Viewport } from "next";
import { Sprite } from "@/components/Sprite";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pivot — find the line you're already on",
  description:
    "Most advice guesses where you are. Pivot tests it — then maps the shortest real route to a job you can actually hold.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Sprite />
        {children}
      </body>
    </html>
  );
}
