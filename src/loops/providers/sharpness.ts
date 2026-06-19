import { Jimp } from "jimp";

/** Convert an RGBA byte buffer to a grayscale luminance array (Rec. 601). */
export function toGrayscale(rgba: Uint8Array, width: number, height: number): Float64Array {
  const gray = new Float64Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!;
  }
  return gray;
}

/** Variance of the Laplacian — the standard focus/blur metric. Higher = sharper.
 *  This is the real signal-processing core of Loop A1's "filter blurry frames". */
export function varianceOfLaplacian(gray: Float64Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const r = -4 * gray[i]! + gray[i - 1]! + gray[i + 1]! + gray[i - width]! + gray[i + width]!;
      sum += r;
      sumSq += r * r;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Decode an image (path or buffer) to a grayscale array via jimp. */
export async function decodeToGray(
  input: string | Buffer,
): Promise<{ gray: Float64Array; width: number; height: number }> {
  const img = await Jimp.read(input as Parameters<typeof Jimp.read>[0]);
  const { data, width, height } = img.bitmap;
  return { gray: toGrayscale(data, width, height), width, height };
}

export async function frameSharpness(input: string | Buffer): Promise<number> {
  const { gray, width, height } = await decodeToGray(input);
  return varianceOfLaplacian(gray, width, height);
}
