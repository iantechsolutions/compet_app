import "~/styles/globals.css";

import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Compet APP",
  description: "App de gestión de información",
  icons: [{ rel: "icon", url: "/icon.png" }],
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`font-sans ${inter.variable}`}>
        {props.children}
      </body>
    </html>
  );
}
