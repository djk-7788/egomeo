/**
 * lib/probe-media.ts
 * 미디어 URL에서 width/height를 추출하는 공통 유틸리티 (Next.js API Route용)
 *
 * 이미지: probe-image-size — URL 최소 바이트만 읽음, 로컬 저장 없음 (regular dep, Vercel 동작)
 * 영상:  ffprobe-static  — URL 직접 probe, 로컬 저장 없음 (devDep: Vercel에서 null 반환)
 *
 * JS 버전은 lib/probe-media.mjs 참고 (fill-media-dimensions.mjs에서 사용)
 */
import probe from 'probe-image-size'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type MediaDimension = { width: number; height: number }

async function probeVideo(url: string): Promise<MediaDimension | null> {
  let ffprobePath: string
  try {
    // devDependency이므로 Vercel production에서 없을 수 있음
    const mod = await import('ffprobe-static')
    ffprobePath = (mod as unknown as { path: string }).path ?? mod.default?.path
    if (!ffprobePath) return null
  } catch {
    return null
  }
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
    const data = JSON.parse(stdout) as {
      streams?: Array<{
        width?: number
        height?: number
        tags?: { rotate?: string }
        side_data_list?: Array<{ rotation?: string }>
      }>
    }
    const stream = data.streams?.[0]
    if (!stream?.width || !stream?.height) return null
    let { width, height } = stream
    const rotate = Math.abs(
      parseInt(stream.tags?.rotate ?? stream.side_data_list?.[0]?.rotation ?? '0', 10)
    )
    if (rotate === 90 || rotate === 270) [width, height] = [height, width]
    return { width, height }
  } catch (err) {
    console.error('[probe-media] 영상 probe 실패:', (err as Error).message)
    return null
  }
}

async function probeImage(url: string): Promise<MediaDimension | null> {
  try {
    const result = await probe(url)
    if (!result?.width || !result?.height) return null
    return { width: result.width, height: result.height }
  } catch (err) {
    console.error('[probe-media] 이미지 probe 실패:', (err as Error).message)
    return null
  }
}

/**
 * 미디어 우선순위에 따라 dimension 추출
 * video_url > image_urls[0] > image_url
 * 실패 시 null 반환 — 상품 등록/수정 자체는 계속 진행
 */
export async function getMediaDimension(
  videoUrl?: string | null,
  imageUrls?: string[] | null,
  imageUrl?: string | null
): Promise<MediaDimension | null> {
  if (videoUrl) return probeVideo(videoUrl)
  const imgUrl = Array.isArray(imageUrls) && imageUrls.length > 0 ? imageUrls[0] : imageUrl
  if (!imgUrl) return null
  return probeImage(imgUrl)
}
