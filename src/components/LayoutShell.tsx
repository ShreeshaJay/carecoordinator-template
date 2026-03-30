'use client'

import { usePathname } from 'next/navigation'
import Nav from './Nav'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 p-4 md:p-8 max-w-5xl">
        {children}
      </main>
    </div>
  )
}
