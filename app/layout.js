import './globals.css';
import { AppConfigProvider } from './fish-farms-module/context/AppConfig';
import { FilterProvider } from './fish-farms-module/context/FilterContext';

export const metadata = {
  title: 'China Fish Farms Map',
  description: 'Interactive maps showing fish farms in China',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppConfigProvider>
          <FilterProvider>
            {children}
          </FilterProvider>
        </AppConfigProvider>
      </body>
    </html>
  )
}
