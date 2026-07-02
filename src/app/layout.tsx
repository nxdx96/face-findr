import "../styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Face-Findr V2",
  description: "A modern recommendation-first frontend for beauty product discovery.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
