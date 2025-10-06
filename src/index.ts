import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const {
  AprilTagDetector: NativeDetector,
} = require('../build/Release/apriltags-kaess-node.node');

export interface TagDetection {
  /** Tag ID */
  id: number;

  /** Hamming distance (0 = perfect match) */
  hammingDistance: number;

  /** Whether the detection is considered good */
  good: boolean;

  /** Center coordinates [x, y] in pixels */
  center: [number, number];

  /** Four corner coordinates [[x, y], [x, y], [x, y], [x, y]] in pixels */
  corners: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];

  /** 3x3 homography matrix (row-major order) */
  homography: number[];
}

export interface Detector {
  detect(imageBuffer: Buffer, width: number, height: number): TagDetection[];
}

export interface DetectorOptions {
  /** Black border width in bits (1 or 2). Use 2 for Kalibr AprilGrid targets. Default: 1 */
  blackBorder?: number;
}

/**
 * Supported AprilTag families
 */
export const TAG_FAMILIES = {
  TAG_36H11: '36h11',
  TAG_36H9: '36h9',
  TAG_25H9: '25h9',
  TAG_25H7: '25h7',
  TAG_16H5: '16h5',
} as const;

/**
 * Create an AprilTag detector for a specific tag family
 * @param tagFamily - One of the TAG_FAMILIES values (default: '36h11')
 * @param options - Optional configuration
 * @returns Detector instance
 */
export function createDetector(
  tagFamily: string = TAG_FAMILIES.TAG_36H11,
  options: DetectorOptions = {}
): Detector {
  return new NativeDetector(tagFamily, options);
}

/**
 * Detect AprilTags in an image buffer
 * @param detector - Detector instance from createDetector
 * @param imageBuffer - Grayscale or RGB/RGBA image buffer
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Array of detected tags with id, center, corners, homography, etc.
 */
export function detect(
  detector: Detector,
  imageBuffer: Buffer,
  width: number,
  height: number
): TagDetection[] {
  if (!Buffer.isBuffer(imageBuffer)) {
    throw new TypeError('imageBuffer must be a Buffer');
  }

  if (typeof width !== 'number' || typeof height !== 'number') {
    throw new TypeError('width and height must be numbers');
  }

  return detector.detect(imageBuffer, width, height);
}

export class AprilTagDetector implements Detector {
  private detector: Detector;

  constructor(tagFamily: string, options?: DetectorOptions) {
    this.detector = new NativeDetector(tagFamily, options);
  }

  detect(imageBuffer: Buffer, width: number, height: number): TagDetection[] {
    return this.detector.detect(imageBuffer, width, height);
  }
}
