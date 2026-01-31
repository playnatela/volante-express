import "./globals.css";

export const metadata = {
  title: "Volante Express", 
  description: "Gestão de Instalação de Volantes",
  manifest: "/manifest.json",
  icons: {
    icon: '/icon.png', // Força o uso do seu logo png como favicon
    shortcut: '/icon.png',
    apple: '/icon.png', // Ícone para iPhone
  }
};

export const viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}