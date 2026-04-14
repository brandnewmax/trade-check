export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import {
  getGlobalSettings,
  saveGlobalSettings,
  getUserSettings,
  saveUserSettings,
  getSerpUsage,
} from '@/lib/kv'

// GET: admin gets global + own; user gets their own apiKey/modelName
export async function GET() {
  const { session, error, status } = await requireSession()
  if (error) return NextResponse.json({ error }, { status })

  if (session.role === 'admin') {
    const [global, userOwn, serpUsage] = await Promise.all([
      getGlobalSettings(),
      getUserSettings(session.email),
      getSerpUsage(),
    ])
    return NextResponse.json({
      ...global,
      ...userOwn,
      serpUsage,
      role: 'admin',
    })
  } else {
    const userOwn = await getUserSettings(session.email)
    return NextResponse.json({ ...userOwn, role: 'user' })
  }
}

export async function POST(req) {
  const { session, error, status } = await requireSession()
  if (error) return NextResponse.json({ error }, { status })

  const data = await req.json()

  if (session.role === 'admin') {
    await saveGlobalSettings({
      baseUrl: data.baseUrl,
      systemPrompt: data.systemPrompt,
      fallbackSystemPrompt: data.fallbackSystemPrompt,
      serpApiKey: data.serpApiKey,
      extractionModel: data.extractionModel,
      extractionPrompt: data.extractionPrompt,
    })
    await saveUserSettings(session.email, { apiKey: data.apiKey, modelName: data.modelName })
  } else {
    await saveUserSettings(session.email, { apiKey: data.apiKey, modelName: data.modelName })
  }

  return NextResponse.json({ ok: true })
}
