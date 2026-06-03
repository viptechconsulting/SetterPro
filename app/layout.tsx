import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SetterPro — LinkedIn Prospecting on Autopilot",
  description: "Convierte tu LinkedIn en una máquina de prospección automática con IA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
