import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import Link from 'next/link'
import LogoutButton from './_LogoutButton'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }) {
  const session = await getSession()
  if (!session) redirect('/')
  if (session.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen bg-white text-stripe-navy flex flex-col">
      <header className="h-14 border-b border-stripe-border flex items-center px-4 sm:px-6 gap-4 sticky top-0 bg-white z-10">
        <Link href="/" className="flex items-center gap-2 text-stripe-navy hover:text-stripe-purple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="font-normal text-body">SnapCheck Debug</span>
        </Link>
        <div className="flex-1" />
        <Link
          href="/"
          className="text-link text-stripe-purple hover:text-stripe-purpleHover"
        >
          ← 返回主页
        </Link>
        <span className="text-caption text-stripe-body">{session.email}</span>
        <LogoutButton />
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
