import "../styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Ingredi-Findr",
  description: "A modern recommendation-first frontend for beauty product discovery.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
