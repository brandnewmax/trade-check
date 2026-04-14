// Pure function: convert an intel object into a human-readable markdown briefing
// that will be injected as the first block of the main LLM's user message.

function statusLine(section) {
  if (!section) return '- 状态:跳过(无数据)'
  if (section.status === 'failed') return `- 状态:❌ 失败(${section.error || '未知错误'})`
  if (section.status === 'skipped') return `- 状态:⊘ 跳过(${section.error || '无数据'})`
  return '- 状态:✓ 成功'
}

function renderResults(list) {
  if (!Array.isArray(list) || list.length === 0) return '  (无)'
  return list
    .map((r, i) => `  ${i + 1}. ${r.title || '(无标题)'} — ${r.link || ''}\n     ${r.snippet || ''}`)
    .join('\n')
}

export function formatIntelAsBriefing(intel) {
  if (!intel) return '# 实时情报简报\n\n(无情报数据)'

  const e = intel.extracted
  const lines = []
  lines.push('# 实时情报简报(发件方背景调查 · 请作为判断依据)')
  lines.push('')
  lines.push('> 以下所有信息均指**发件方**(询盘发送者),不是我方。')
  lines.push('')

  lines.push('## 1. 发件方实体识别')
  if (!e) {
    lines.push('- 未能识别(询盘和图片里没有足够信息定位发件方)')
  } else {
    lines.push(`- 公司名:${e.companyName || '未能识别'}`)
    if (e.companyUrl) lines.push(`- 公司网址:${e.companyUrl}`)
    lines.push(`- 联系人:${e.personName || '未识别'}${e.personTitle ? `(${e.personTitle})` : ''}`)
    lines.push(`- 邮箱:${e.email || '未识别'}`)
    lines.push(`- 电话:${e.phone || '未识别'}`)
    lines.push(`- 国家:${e.country || '未识别'}`)
    lines.push(`- 询问产品:${(e.products && e.products.length) ? e.products.join(', ') : '未识别'}`)
  }
  lines.push('')

  const w = intel.website || {}
  lines.push('## 2. 发件方公司网站')
  lines.push(statusLine(w))
  if (w.status === 'ok') {
    lines.push(`- 标题:${w.title || '(无)'}`)
    lines.push(`- 正文摘录(前 800 字):`)
    lines.push(`  ${(w.excerpt || '').slice(0, 800).replace(/\n/g, ' ')}`)
  }
  lines.push('')

  const li = intel.linkedin || {}
  lines.push('## 3. LinkedIn 核验')
  lines.push(statusLine(li))
  if (li.status === 'ok') {
    lines.push(`- 查询:\`${li.query}\``)
    lines.push(`- 结果:${li.found ? `✓ 找到 ${li.topResults.length} 条` : '✗ 未找到'}`)
    if (li.found) lines.push(renderResults(li.topResults))
  }
  lines.push('')

  const fb = intel.facebook || {}
  lines.push('## 4. Facebook 核验')
  lines.push(statusLine(fb))
  if (fb.status === 'ok') {
    lines.push(`- 查询:\`${fb.query}\``)
    lines.push(`- 结果:${fb.found ? `✓ 找到 ${fb.topResults.length} 条` : '✗ 未找到'}`)
    if (fb.found) lines.push(renderResults(fb.topResults))
  }
  lines.push('')

  const pj = intel.panjiva || {}
  lines.push('## 5. Panjiva 海关足迹')
  lines.push(statusLine(pj))
  if (pj.status === 'ok') {
    lines.push(`- 查询:\`${pj.query}\``)
    lines.push(`- 结果:${pj.hasRecord ? `✓ 搜到 ${pj.resultCount} 条相关记录` : '✗ 未发现海关记录'}`)
  }
  lines.push('')

  const ng = intel.negative || {}
  lines.push('## 6. 负面 / 诈骗搜索')
  lines.push(statusLine(ng))
  if (ng.status === 'ok') {
    lines.push(`- 查询:\`${ng.query}\``)
    lines.push(`- 结果:${ng.hitCount > 0 ? `⚠️ 发现 ${ng.hitCount} 条负面信息` : '✓ 未发现负面信息'}`)
    if (ng.hitCount > 0) lines.push(renderResults(ng.hits))
  }
  lines.push('')

  const ph = intel.phone || {}
  lines.push('## 7. 发件方电话核验')
  lines.push(statusLine(ph))
  if (ph.status === 'ok') {
    lines.push(`- 查询:\`${ph.query}\``)
    lines.push(`- 结果:${ph.hitCount > 0 ? `✓ 找到 ${ph.hitCount} 条公开记录` : '✗ 未发现公开记录'}`)
    if (ph.hitCount > 0) lines.push(renderResults(ph.hits))
  }
  lines.push('')

  const gs = intel.generalSearch || {}
  lines.push('## 8. 通用搜索')
  lines.push(statusLine(gs))
  if (gs.status === 'ok') {
    lines.push(`- 查询:\`${gs.query}\``)
    lines.push(`- 前 ${gs.topResults.length} 条结果:`)
    lines.push(renderResults(gs.topResults))
  }
  lines.push('')

  const wb = intel.wayback || {}
  lines.push('## 9. 发件方建站时间(Wayback Machine)')
  lines.push(statusLine(wb))
  if (wb.status === 'ok') {
    if (wb.firstSnapshot) {
      lines.push(`- 最早快照:${wb.firstSnapshot}`)
      lines.push(`- 建站约 ${wb.ageYears} 年${wb.ageYears != null && wb.ageYears < 2 ? ' ⚠️ 不足 2 年' : ''}`)
    } else {
      lines.push('- Wayback 无任何快照记录(可能是非常新的站点或从未被归档)')
    }
  }

  return lines.join('\n')
}
