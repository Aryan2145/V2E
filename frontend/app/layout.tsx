import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/lib/auth/context'
import QueryProvider from '@/lib/providers/QueryProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { NotificationsProvider } from '@/lib/notifications/NotificationsProvider'
import NoScrollNumberInputs from '@/components/ui/NoScrollNumberInputs'
import SplashGate from '@/components/ui/SplashGate'
import NotificationsOptInPrompt from '@/components/notifications/NotificationsOptInPrompt'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'V2E',
  description: 'The operating system for your organisation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-[family-name:var(--font-inter)] antialiased bg-[#F8FAFC] text-[#1E293B]">
        <QueryProvider>
          <AuthProvider>
            <NoScrollNumberInputs />
            <ToastProvider>
              <NotificationsProvider>
                <SplashGate>{children}</SplashGate>
                <NotificationsOptInPrompt />
              </NotificationsProvider>
            </ToastProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
