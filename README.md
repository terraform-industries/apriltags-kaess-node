# @monumental-works/apriltags-kaess-node

Node.js bindings for the [AprilTags](https://bitbucket.org/kaess/apriltags/) C++ library.

## Installation

**Prerequisites:** OpenCV and Eigen3

```bash
brew install opencv eigen
npm install @monumental-works/apriltags-kaess-node
```

## Usage

```javascript
import {
  createDetector,
  TAG_FAMILIES,
} from '@monumental-works/apriltags-kaess-node';
import { Jimp } from 'jimp';

const image = await Jimp.read('image.jpg');
image.greyscale();

const buffer = Buffer.from(image.bitmap.data.filter((_, i) => i % 4 === 0));
const detector = createDetector(TAG_FAMILIES.TAG_36H11);
const detections = detector.detect(
  buffer,
  image.bitmap.width,
  image.bitmap.height
);

detections.forEach((tag) => {
  console.log(`Tag ${tag.id} at [${tag.center[0]}, ${tag.center[1]}]`);
});
```

For Kalibr AprilGrid targets with double-width borders:

```javascript
const detector = createDetector(TAG_FAMILIES.TAG_36H11, { blackBorder: 2 });
```

## Demo & Testing

```bash
# Run interactive demo
npm run demo data/tag36h11.png
npm run demo data/aprilgrid.png 2

# Run tests
npm test
```

## License

**Bindings:** MIT
**AprilTags library:** LGPL 2.1 (see [apriltags/LICENSE](apriltags/LICENSE))
