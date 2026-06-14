/**
 * lib/probe-media.mjs
 * 미디어 URL에서 width/height를 추출하는 공통 유틸리티 (ESM JS, 스크립트용)
 *
 * 이미지: probe-image-size — URL 최소 바이트만 읽음, 로컬 저장 없음
 * 영상:  ffprobe-static  — URL 직접 probe, 로컬 저장 없음
 *
 * TS 버전은 lib/probe-media.ts 참고 (Next.js API Route에서 사용)
 */
import { createRequire } from 'module'
import { execFile } from 'child_process'
import { promisify } from 'util'

const require = createRequire(import.meta.url)
const execFileAsync = promisify(execFile)

function tryRequire(id) {
  try {
    return require(id)
  } catch {
    return null
  }
}

const probeImageSize = tryRequire('probe-image-size')
const ffprobeStatic = tryRequire('ffprobe-static')

function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`타임아웃 ${ms / 1000}초 (${label})`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function probeVideo(url) {
  const ffprobePath = ffprobeStatic?.path
  if (!ffprobePath) return null
  try {
    const { stdout } = await execFileAsync(
      ffprobePath,
      [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_streams',
        '-select_streams', 'v:0',
        '-probesize', '5000000',
        '-analyzeduration', '2000000',
        url,
      ],
      { timeout: 30_000 }
    )
    const data = JSON.parse(stdout)
    const stream = data.streams?.[0]
    if (!stream?.width || !stream?.height) return null
    let { width, height } = stream
    const rotate = Math.abs(
      parseInt(stream?.tags?.rotate ?? stream?.side_data_list?.[0]?.rotation ?? '0', 10)
    )
    if (rotate === 90 || rotate === 270) [width, height] = [height, width]
    return { width, height }
  } catch (err) {
    console.error('[probe-media] 영상 probe 실패:', err.message)
    return null
  }
}

async function probeImage(url) {
  if (!probeImageSize) return null
  try {
    const result = await withTimeout(probeImageSize(url), 20_000, 'image')
    if (!result?.width || !result?.height) return null
    return { width: result.width, height: result.height }
  } catch (err) {
    console.error('[probe-media] 이미지 probe 실패:', err.message)
    return null
  }
}

/**
 * 미디어 우선순위에 따라 dimension 추출
 * videoUrl > imageUrls[0] > imageUrl
 * 실패 시 null 반환
 */
export async function getMediaDimension(videoUrl, imageUrls, imageUrl) {
  if (videoUrl) {
    return withTimeout(probeVideo(videoUrl), 35_000, 'video').catch((err) => {
      console.error('[probe-media] 영상 timeout:', err.message)
      return null
    })
  }
  const imgUrl = Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls[0] : imageUrl
  if (!imgUrl) return null
  return probeImage(imgUrl)
}
