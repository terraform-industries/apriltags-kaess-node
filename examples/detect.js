#!/usr/bin/env node

import { createDetector, TAG_FAMILIES } from '../dist/index.js';
import { Jimp } from 'jimp';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;

async function detectAndServe(imagePath, blackBorder = 1) {
  console.log(`\nLoading image: ${imagePath}`);

  const image = await Jimp.read(imagePath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;

  console.log(`Image dimensions: ${width}x${height}`);

  // Convert to grayscale for detection
  const grayImage = image.clone().greyscale();
  const buffer = Buffer.from(
    grayImage.bitmap.data.filter((_, i) => i % 4 === 0)
  );

  console.log(`Creating detector with blackBorder=${blackBorder}...`);
  const detector = createDetector(TAG_FAMILIES.TAG_36H11, { blackBorder });

  console.log('Detecting tags...');
  const detections = detector.detect(buffer, width, height);

  console.log(`\nDetected ${detections.length} tags:`);
  detections.forEach((tag, i) => {
    console.log(
      `  Tag ${i + 1}: ID=${tag.id}, Center=[${tag.center[0].toFixed(
        1
      )}, ${tag.center[1].toFixed(1)}], Hamming=${tag.hammingDistance}`
    );
  });

  // Convert image to base64 for embedding
  const imageBase64 = await image.getBase64('image/jpeg');

  const htmlPage = generateHTML(
    imageBase64,
    detections,
    width,
    height,
    basename(imagePath),
    blackBorder
  );

  const server = createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(htmlPage);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(PORT, () => {
    console.log(`\n✓ Server running at http://localhost:${PORT}`);
    console.log(`  Open your browser to view the annotated image`);
    console.log(`  Press Ctrl+C to stop\n`);
  });
}

function generateHTML(
  imageBase64,
  detections,
  width,
  height,
  filename,
  blackBorder
) {
  const detectionsJSON = JSON.stringify(detections, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AprilTag Detection - ${filename}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      padding: 30px;
    }

    h1 {
      color: #333;
      margin-bottom: 10px;
    }

    .info {
      color: #666;
      margin-bottom: 20px;
      font-size: 14px;
    }

    .content {
      display: grid;
      grid-template-columns: 1fr 350px;
      gap: 30px;
    }

    .canvas-container {
      position: relative;
      background: #fafafa;
      border-radius: 4px;
      overflow: hidden;
    }

    canvas {
      display: block;
      max-width: 100%;
      height: auto;
    }

    .sidebar {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 4px;
      max-height: 800px;
      overflow-y: auto;
    }

    .stats {
      background: white;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
    }

    .stats h3 {
      margin-bottom: 10px;
      color: #333;
      font-size: 16px;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }

    .stat-item:last-child {
      border-bottom: none;
    }

    .stat-label {
      color: #666;
      font-size: 14px;
    }

    .stat-value {
      font-weight: 600;
      color: #333;
    }

    .detections {
      background: white;
      padding: 15px;
      border-radius: 4px;
    }

    .detections h3 {
      margin-bottom: 10px;
      color: #333;
      font-size: 16px;
    }

    .tag-item {
      padding: 10px;
      margin-bottom: 8px;
      background: #f5f5f5;
      border-radius: 4px;
      border-left: 3px solid #4CAF50;
      font-size: 13px;
    }

    .tag-id {
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }

    .tag-detail {
      color: #666;
      font-size: 12px;
    }

    @media (max-width: 900px) {
      .content {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>AprilTag Detection Results</h1>
    <div class="info">
      <strong>Image:</strong> ${filename} |
      <strong>Dimensions:</strong> ${width}×${height} |
      <strong>Black Border:</strong> ${blackBorder} bit${
        blackBorder > 1 ? 's' : ''
      }
    </div>

    <div class="content">
      <div class="canvas-container">
        <canvas id="canvas" width="${width}" height="${height}"></canvas>
      </div>

      <div class="sidebar">
        <div class="stats">
          <h3>Detection Statistics</h3>
          <div class="stat-item">
            <span class="stat-label">Total Tags</span>
            <span class="stat-value">${detections.length}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Good Quality</span>
            <span class="stat-value">${
              detections.filter((d) => d.good).length
            }</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Perfect Matches</span>
            <span class="stat-value">${
              detections.filter((d) => d.hammingDistance === 0).length
            }</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Tag IDs</span>
            <span class="stat-value">${
              detections.length > 0
                ? Math.min(...detections.map((d) => d.id)) +
                  '-' +
                  Math.max(...detections.map((d) => d.id))
                : 'None'
            }</span>
          </div>
        </div>

        <div class="detections">
          <h3>Detected Tags</h3>
          ${detections
            .map(
              (tag, i) => `
            <div class="tag-item">
              <div class="tag-id">Tag ${i + 1}: ID ${tag.id}</div>
              <div class="tag-detail">Center: (${tag.center[0].toFixed(
                1
              )}, ${tag.center[1].toFixed(1)})</div>
              <div class="tag-detail">Hamming: ${
                tag.hammingDistance
              } | Quality: ${tag.good ? '✓ Good' : '✗ Poor'}</div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    </div>
  </div>

  <script>
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const detections = ${detectionsJSON};

    const img = new Image();
    img.onload = function() {
      // Draw the image
      ctx.drawImage(img, 0, 0);

      // Draw detections
      detections.forEach((tag, index) => {
        const hue = (index * 137.5) % 360;
        const color = \`hsl(\${hue}, 70%, 50%)\`;

        // Draw corners
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(tag.corners[0][0], tag.corners[0][1]);
        for (let i = 1; i < 4; i++) {
          ctx.lineTo(tag.corners[i][0], tag.corners[i][1]);
        }
        ctx.closePath();
        ctx.stroke();

        // Draw corner points
        ctx.fillStyle = color;
        tag.corners.forEach((corner, i) => {
          ctx.beginPath();
          ctx.arc(corner[0], corner[1], 5, 0, Math.PI * 2);
          ctx.fill();

          // Number the corners
          ctx.fillStyle = 'white';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(i, corner[0], corner[1]);
          ctx.fillStyle = color;
        });

        // Draw center
        ctx.beginPath();
        ctx.arc(tag.center[0], tag.center[1], 8, 0, Math.PI * 2);
        ctx.fill();

        // Draw ID label
        ctx.fillStyle = color;
        ctx.font = 'bold 24px sans-serif';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText('ID ' + tag.id, tag.center[0], tag.center[1] - 40);
        ctx.fillText('ID ' + tag.id, tag.center[0], tag.center[1] - 40);
      });
    };

    img.src = '${imageBase64}';
  </script>
</body>
</html>`;
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
AprilTag Detection Demo

Usage: npm run demo <image-path> [blackBorder]

Arguments:
  image-path   Path to the image file
  blackBorder  Black border width (1 or 2, default: 1)
               Use 2 for Kalibr AprilGrid targets

Examples:
  npm run demo data/tag36h11.png
  npm run demo data/aprilgrid.png 2

After running, open http://localhost:${PORT} in your browser
  `);
  process.exit(0);
}

const imagePath = args[0];
const blackBorder = args[1] ? parseInt(args[1]) : 1;

detectAndServe(imagePath, blackBorder).catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
