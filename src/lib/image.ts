// Shrink camera photos (~3-5MB) to ~200-400KB JPEGs before storing.
export async function compressImage(file: File, maxSide = 1600, quality = 0.72): Promise<Blob> {
  let src: ImageBitmap | HTMLImageElement
  let w: number, h: number
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    src = bmp; w = bmp.width; h = bmp.height
  } catch {
    const img = await loadImg(file)
    src = img; w = img.naturalWidth; h = img.naturalHeight
  }
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const cw = Math.round(w * scale)
  const ch = Math.round(h * scale)
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(src, 0, 0, cw, ch)
  if ('close' in src) src.close()
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  return blob ?? file
}

function loadImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}
