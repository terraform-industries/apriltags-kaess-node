import { describe, it, expect } from 'vitest';
import { createDetector, TAG_FAMILIES } from '../dist/index.js';
import { Jimp } from 'jimp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('AprilTag Detection', () => {
  describe('Standard AprilTags (blackBorder=1)', () => {
    it('should detect all tags in tag36h11.png', async () => {
      const imagePath = join(__dirname, '..', 'data', 'tag36h11.png');
      const image = await Jimp.read(imagePath);

      image.greyscale();
      const buffer = Buffer.from(
        image.bitmap.data.filter((_, i) => i % 4 === 0)
      );

      const detector = createDetector(TAG_FAMILIES.TAG_36H11);
      const detections = detector.detect(
        buffer,
        image.bitmap.width,
        image.bitmap.height
      );

      expect(detections).toHaveLength(24);

      // All should be good quality
      const goodDetections = detections.filter((d) => d.good);
      expect(goodDetections).toHaveLength(24);

      // All should have perfect hamming distance
      const perfectDetections = detections.filter(
        (d) => d.hammingDistance === 0
      );
      expect(perfectDetections).toHaveLength(24);

      // Should detect tags 0-23
      const ids = detections.map((d) => d.id).sort((a, b) => a - b);
      expect(ids).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20, 21, 22, 23,
      ]);
    });

    it('should return tag with correct structure', async () => {
      const imagePath = join(__dirname, '..', 'data', 'tag36h11.png');
      const image = await Jimp.read(imagePath);

      image.greyscale();
      const buffer = Buffer.from(
        image.bitmap.data.filter((_, i) => i % 4 === 0)
      );

      const detector = createDetector(TAG_FAMILIES.TAG_36H11);
      const detections = detector.detect(
        buffer,
        image.bitmap.width,
        image.bitmap.height
      );

      const tag = detections[0];

      expect(tag).toHaveProperty('id');
      expect(tag).toHaveProperty('hammingDistance');
      expect(tag).toHaveProperty('good');
      expect(tag).toHaveProperty('center');
      expect(tag).toHaveProperty('corners');
      expect(tag).toHaveProperty('homography');

      expect(tag.center).toHaveLength(2);
      expect(tag.corners).toHaveLength(4);
      expect(tag.corners[0]).toHaveLength(2);
      expect(tag.homography).toHaveLength(9);

      expect(typeof tag.id).toBe('number');
      expect(typeof tag.hammingDistance).toBe('number');
      expect(typeof tag.good).toBe('boolean');
    });
  });

  describe('Kalibr AprilGrid (blackBorder=2)', () => {
    it('should detect all tags in aprilgrid.png', async () => {
      const imagePath = join(__dirname, '..', 'data', 'aprilgrid.png');
      const image = await Jimp.read(imagePath);

      image.greyscale();
      const buffer = Buffer.from(
        image.bitmap.data.filter((_, i) => i % 4 === 0)
      );

      // Kalibr AprilGrid uses double-width borders
      const detector = createDetector(TAG_FAMILIES.TAG_36H11, {
        blackBorder: 2,
      });
      const detections = detector.detect(
        buffer,
        image.bitmap.width,
        image.bitmap.height
      );

      // 6x6 grid should have 36 tags
      expect(detections).toHaveLength(36);

      // All should be good quality
      const goodDetections = detections.filter((d) => d.good);
      expect(goodDetections).toHaveLength(36);

      // All should have perfect hamming distance
      const perfectDetections = detections.filter(
        (d) => d.hammingDistance === 0
      );
      expect(perfectDetections).toHaveLength(36);

      // Should detect tags 0-35
      const ids = detections.map((d) => d.id).sort((a, b) => a - b);
      expect(ids).toEqual([...Array(36).keys()]); // [0, 1, 2, ..., 35]
    });

    it('should fail to detect AprilGrid with blackBorder=1', async () => {
      const imagePath = join(__dirname, '..', 'data', 'aprilgrid.png');
      const image = await Jimp.read(imagePath);

      image.greyscale();
      const buffer = Buffer.from(
        image.bitmap.data.filter((_, i) => i % 4 === 0)
      );

      // Using wrong blackBorder setting should detect fewer or no tags
      const detector = createDetector(TAG_FAMILIES.TAG_36H11, {
        blackBorder: 1,
      });
      const detections = detector.detect(
        buffer,
        image.bitmap.width,
        image.bitmap.height
      );

      // Should detect significantly fewer tags with wrong border setting
      expect(detections.length).toBeLessThan(36);
    });
  });

  describe('Detector options', () => {
    it('should create detector with default blackBorder=1', async () => {
      const detector = createDetector(TAG_FAMILIES.TAG_36H11);
      expect(detector).toBeDefined();
      expect(typeof detector.detect).toBe('function');
    });

    it('should create detector with custom blackBorder', async () => {
      const detector = createDetector(TAG_FAMILIES.TAG_36H11, {
        blackBorder: 2,
      });
      expect(detector).toBeDefined();
      expect(typeof detector.detect).toBe('function');
    });

    it('should throw error for invalid tag family', () => {
      expect(() => {
        createDetector('invalid-family');
      }).toThrow();
    });
  });
});
