import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MICS Survey Content Dashboard",
  description: "Explore MICS questionnaire coverage by round, region and country.",
  openGraph: {
    title: "MICS Survey Content Dashboard",
    description: "Explore survey content by round, region and country.",
    images: [{ url: "/og.png", width: 1792, height: 1024, alt: "MICS Survey Content Dashboard preview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MICS Survey Content Dashboard",
    description: "Explore survey content by round, region and country.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
