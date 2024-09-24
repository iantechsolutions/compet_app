import "~/styles/globals.css";

import { Inter, Montserrat } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});
const montserrat = Montserrat({
  subsets: ["latin-ext"],
  weight: ["400", "500", "700"],
});

export const runtime = "edge";

export const metadata = {
  title: "Compet APP",
  description: "App de gestión de información",
  icons: [{ rel: "icon", url: "/icon.png" }],
};

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`font-family ${montserrat.className}`}>
        {props.children}
        <script src="https://cdn.scaledrone.com/scaledrone-lite.min.js" type="text/javascript"></script>
      </body>
    </html>
  );
}
