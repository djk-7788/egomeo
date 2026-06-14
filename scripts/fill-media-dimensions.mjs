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
 */

import { createRequire } from 'module'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
const probeImageSize = require('probe-image-size')
const ffprobeStatic = require('ffprobe-static')

const execFileAsync = promisify(execFile)
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
  ...process.env, // 환경변수로 직접 전달한 값이 .env.local보다 우선
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
const FFPROBE = ffprobeStatic.path

// ──────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────
function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`타임아웃 ${ms / 1000}초 (${label})`)),
      ms
    )
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

// ──────────────────────────────────────────────
// 영상 dimension 추출 (ffprobe URL 직접 probe, 로컬 저장 없음)
// ──────────────────────────────────────────────
async function probeVideo(url) {
  const { stdout } = await execFileAsync(
    FFPROBE,
    [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-select_streams', 'v:0',
      '-probesize', '5000000',       // 최대 5MB 읽기
      '-analyzeduration', '2000000', // 최대 2초 분석
      url,
    ],
    { timeout: 30_000 }
  )

  const data = JSON.parse(stdout)
  const stream = data.streams?.[0]

  // rotate 90/270 이면 width/height 교환
  const rotate = Math.abs(parseInt(stream?.tags?.rotate ?? stream?.side_data_list?.[0]?.rotation ?? '0', 10))
  let { width, height } = stream ?? {}
  if (!width || !height) throw new Error('비디오 스트림 dimension 없음')
  if (rotate === 90 || rotate === 270) [width, height] = [height, width]

  return { width, height }
}

// ──────────────────────────────────────────────
// 이미지 dimension 추출 (probe-image-size: 최소 바이트만 읽음, 로컬 저장 없음)
// ──────────────────────────────────────────────
async function probeImage(url) {
  const result = await probeImageSize(url)
  if (!result?.width || !result?.height) throw new Error('이미지 dimension 없음')
  return { width: result.width, height: result.height }
}

// ──────────────────────────────────────────────
// 미디어 우선순위: video_url > image_urls[0] > image_url
// ──────────────────────────────────────────────
async function getMediaDimension(product) {
  const { video_url, image_urls, image_url } = product

  if (video_url) {
    const dim = await withTimeout(probeVideo(video_url), 35_000, 'video')
    return { type: 'video', mediaUrl: video_url, ...dim }
  }

  const imgUrl =
    Array.isArray(image_urls) && image_urls.length > 0
      ? image_urls[0]
      : image_url

  if (!imgUrl) throw new Error('미디어 URL 없음')

  const dim = await withTimeout(probeImage(imgUrl), 20_000, 'image')
  return { type: 'image', mediaUrl: imgUrl, ...dim }
}

// ──────────────────────────────────────────────
// 메인
// ──────────────────────────────────────────────
const BATCH_SIZE = 5   // 동시 처리 수 (과부하 방지)
const BATCH_DELAY = 300 // 배치 간 대기 ms

async function main() {
  console.log('\n📐 media_width / media_height 일괄 채우기')
  console.log('─'.repeat(52))
  console.log(`ffprobe: ${FFPROBE}`)
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
          const { width, height, type } = await getMediaDimension(p)

          const { error: updateErr } = await supabase
            .from('products')
            .update({ media_width: width, media_height: height })
            .eq('id', p.id)

          if (updateErr) throw new Error(`DB 업데이트 실패: ${updateErr.message}`)

          successCount++
          const icon = type === 'video' ? '🎬' : '🖼️ '
          console.log(
            `✓ ${String(successCount + failCount).padStart(3)}/${total}  ${icon} ${String(width).padStart(4)}×${String(height).padEnd(4)}  ${p.id.slice(0, 8)}…`
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

    // 배치 간 짧은 대기 (CDN/DB 과부하 방지)
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
