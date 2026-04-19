'use client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  async function onClick() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/')
    router.refresh()
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-link text-stripe-body hover:text-stripe-purple"
    >
      登出
    </button>
  )
}
