// CJS 패키지 타입 선언 (@types/* 없는 것들)
declare module 'probe-image-size' {
  interface ProbeResult {
    width: number
    height: number
    type: string
    mime?: string
    wUnits: string
    hUnits: string
  }
  function probe(src: string | NodeJS.ReadableStream, opts?: object): Promise<ProbeResult>
  export = probe
}

declare module 'ffprobe-static' {
  const ffprobe: { path: string }
  export = ffprobe
}
