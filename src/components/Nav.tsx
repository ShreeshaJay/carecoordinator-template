'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { config } from '@/lib/config'
import { useState } from 'react'
import {
  FileText,
  Clock,
  FolderOpen,
  User,
  PlusCircle,
  List,
  LogOut,
  Menu,
  X,
  GitPullRequestArrow,
  MessageCircle,
  BookOpen,
  Download,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Summary', icon: FileText },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/research', label: 'Research', icon: BookOpen },
  { href: '/timeline', label: 'Timeline', icon: Clock },
  { href: '/referrals', label: 'Referrals', icon: GitPullRequestArrow },
  { href: '/reports', label: 'Reports', icon: FolderOpen },
  { href: '/patient', label: 'Patient', icon: User },
  { href: '/add', label: 'Add Info', icon: PlusCircle },
  { href: '/log', label: 'Activity', icon: List },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 bg-white border-r border-gray-200 min-h-screen p-4">
        <div className="mb-8">
          <h1 className="text-lg font-bold text-gray-900">{config.app_name}</h1>
          <p className="text-xs text-gray-400">Family care hub</p>
        </div>

        <div className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="border-t border-gray-200 pt-3 mt-3 space-y-1">
          <a
            href="/api/export"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            title="Download full backup as JSON"
          >
            <Download size={18} />
            Export Backup
          </a>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors w-full"
          >
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </nav>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">{config.app_name}</h1>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/20" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute top-14 right-0 w-56 bg-white border border-gray-200 rounded-bl-xl shadow-lg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                )
              })}
            </div>
            <hr className="my-3" />
            <a
              href="/api/export"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 w-full"
            >
              <Download size={18} />
              Export Backup
            </a>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 w-full"
            >
              <LogOut size={18} />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Mobile spacer */}
      <div className="md:hidden h-14" />
    </>
  )
}
