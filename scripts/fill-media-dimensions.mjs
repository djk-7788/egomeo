/**
 * scripts/fill-media-dimensions.mjs
 * 1회성 스크립트: products 테이블의 media_width / media_height 일괄 채우기
 *
 * 사전 조건:
 *   1. Supabase SQL 에디터에서 아래 두 줄 실행 완료:
 *        ALTER TABLE products ADD COLUMN IF NOT EXISTS media_width integer;
 *        ALTER TABLE products ADD COLUMN IF NOT EXISTS media_height integer;
 *   2. .env.local 에 SUPABASE_SERVICE_ROLE_KEY 추가
 *        (Supabase 대시보드 > Settings > API > service_role)
 *
 * 실행: node scripts/fill-media-dimensions.mjs
 *
 * probe 로직: lib/probe-media.mjs 에서 공유
 */

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { getMediaDimension } from '../lib/probe-media.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ──────────────────────────────────────────────
// 환경변수 로드 (.env.local 파싱 + process.env 병합)
// ──────────────────────────────────────────────
function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {}
  return Object.fromEntries(
    readFileSync(filePath, 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const idx = l.indexOf('=')
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()]
      })
  )
}

const envVars = {
  ...parseEnvFile(path.join(__dirname, '..', '.env.local')),
  ...process.env,
}

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\n❌ 환경변수 누락:')
  if (!SUPABASE_URL) console.error('   NEXT_PUBLIC_SUPABASE_URL (NEXT_PUBLIC_이 붙은 것)')
  if (!SERVICE_KEY) console.error('   SUPABASE_SERVICE_ROLE_KEY')
  console.error('\n  → .env.local 에 SUPABASE_SERVICE_ROLE_KEY 를 추가 후 재실행하세요.')
  console.error('    (Supabase 대시보드 > Settings > API > service_role key)\n')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ──────────────────────────────────────────────
// 메인
// ──────────────────────────────────────────────
const BATCH_SIZE = 5   // 동시 처리 수 (과부하 방지)
const BATCH_DELAY = 300 // 배치 간 대기 ms

async function main() {
  console.log('\n📐 media_width / media_height 일괄 채우기')
  console.log('─'.repeat(52))
  console.log(`Supabase: ${SUPABASE_URL}\n`)

  // media_width 가 null 인 항목만 조회 (이미 처리된 항목 자동 스킵)
  const { data: products, error } = await supabase
    .from('products')
    .select('id, video_url, image_urls, image_url')
    .is('media_width', null)
    .order('created_at', { ascending: false })

  if (error) throw error

  if (!products || products.length === 0) {
    console.log('✅ 처리할 항목 없음 (모두 이미 채워져 있거나 상품 없음)')
    return
  }

  const total = products.length
  console.log(`대상: ${total}개 (media_width = null)\n`)

  let successCount = 0
  let failCount = 0
  const failures = []

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE)

    await Promise.allSettled(
      batch.map(async (p) => {
        try {
          const dim = await getMediaDimension(p.video_url, p.image_urls, p.image_url)
          if (!dim) throw new Error('dimension 추출 실패 (미디어 없음 또는 probe 오류)')

          const { error: updateErr } = await supabase
            .from('products')
            .update({ media_width: dim.width, media_height: dim.height })
            .eq('id', p.id)

          if (updateErr) throw new Error(`DB 업데이트 실패: ${updateErr.message}`)

          successCount++
          const isVideo = !!p.video_url
          const icon = isVideo ? '🎬' : '🖼️ '
          console.log(
            `✓ ${String(successCount + failCount).padStart(3)}/${total}  ${icon} ${String(dim.width).padStart(4)}×${String(dim.height).padEnd(4)}  ${p.id.slice(0, 8)}…`
          )
        } catch (err) {
          failCount++
          const mediaUrl =
            p.video_url ||
            (Array.isArray(p.image_urls) ? p.image_urls[0] : null) ||
            p.image_url ||
            '(없음)'
          failures.push({ id: p.id, url: mediaUrl, error: err.message })
          console.error(
            `✗ ${String(successCount + failCount).padStart(3)}/${total}  ⚠️  ${p.id.slice(0, 8)}…  — ${err.message}`
          )
        }
      })
    )

    if (i + BATCH_SIZE < products.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY))
    }
  }

  // ── 결과 요약
  console.log('\n' + '─'.repeat(52))
  console.log(`완료:  ✓ ${successCount}개 성공   ✗ ${failCount}개 실패  (전체 ${total}개)`)

  if (failures.length > 0) {
    console.log('\n실패 항목 목록:')
    failures.forEach((f, idx) => {
      console.log(`\n  ${idx + 1}. id : ${f.id}`)
      console.log(`     url: ${f.url}`)
      console.log(`     err: ${f.error}`)
    })
  }
}

main().catch((err) => {
  console.error('\n❌ 스크립트 오류:', err.message)
  process.exit(1)
})
