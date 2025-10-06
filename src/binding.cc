#include <napi.h>
#include <opencv2/opencv.hpp>
#include "AprilTags/TagDetector.h"

// Only include tag families as needed to avoid large lookup tables
#ifdef USE_TAG_16H5
#include "AprilTags/Tag16h5.h"
#endif
#ifdef USE_TAG_25H7
#include "AprilTags/Tag25h7.h"
#endif
#ifdef USE_TAG_25H9
#include "AprilTags/Tag25h9.h"
#endif
#ifdef USE_TAG_36H9
#include "AprilTags/Tag36h9.h"
#endif
#include "AprilTags/Tag36h11.h"  // Default family

class AprilTagDetector : public Napi::ObjectWrap<AprilTagDetector> {
public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  AprilTagDetector(const Napi::CallbackInfo& info);
  ~AprilTagDetector() {
    if (detector) delete detector;
  }

private:
  static Napi::FunctionReference constructor;
  AprilTags::TagDetector* detector;

  Napi::Value Detect(const Napi::CallbackInfo& info);
};

Napi::FunctionReference AprilTagDetector::constructor;

Napi::Object AprilTagDetector::Init(Napi::Env env, Napi::Object exports) {
  Napi::HandleScope scope(env);

  Napi::Function func = DefineClass(env, "AprilTagDetector", {
    InstanceMethod("detect", &AprilTagDetector::Detect)
  });

  constructor = Napi::Persistent(func);
  constructor.SuppressDestruct();

  exports.Set("AprilTagDetector", func);
  return exports;
}

AprilTagDetector::AprilTagDetector(const Napi::CallbackInfo& info)
  : Napi::ObjectWrap<AprilTagDetector>(info), detector(nullptr) {

  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected tag family string").ThrowAsJavaScriptException();
    return;
  }

  if (!info[0].IsString()) {
    Napi::TypeError::New(env, "Tag family must be a string").ThrowAsJavaScriptException();
    return;
  }

  std::string tagFamily = info[0].As<Napi::String>().Utf8Value();

  // Optional: blackBorder parameter (default 1, use 2 for Kalibr AprilGrid)
  int blackBorder = 1;
  if (info.Length() >= 2 && info[1].IsObject()) {
    Napi::Object options = info[1].As<Napi::Object>();
    if (options.Has("blackBorder")) {
      blackBorder = options.Get("blackBorder").As<Napi::Number>().Int32Value();
    }
  }

  const AprilTags::TagCodes* tagCodes = nullptr;

  if (tagFamily == "36h11") {
    tagCodes = &AprilTags::tagCodes36h11;
  }
#ifdef USE_TAG_36H9
  else if (tagFamily == "36h9") {
    tagCodes = &AprilTags::tagCodes36h9;
  }
#endif
#ifdef USE_TAG_25H9
  else if (tagFamily == "25h9") {
    tagCodes = &AprilTags::tagCodes25h9;
  }
#endif
#ifdef USE_TAG_25H7
  else if (tagFamily == "25h7") {
    tagCodes = &AprilTags::tagCodes25h7;
  }
#endif
#ifdef USE_TAG_16H5
  else if (tagFamily == "16h5") {
    tagCodes = &AprilTags::tagCodes16h5;
  }
#endif
  else {
    Napi::TypeError::New(env, "Unknown tag family. Only 36h11 is currently enabled")
      .ThrowAsJavaScriptException();
    return;
  }

  detector = new AprilTags::TagDetector(*tagCodes);

  // Set black border width (for Kalibr AprilGrid with double borders, use 2)
  const_cast<AprilTags::TagFamily&>(detector->thisTagFamily).blackBorder = blackBorder;
}

Napi::Value AprilTagDetector::Detect(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 1) {
    Napi::TypeError::New(env, "Expected image buffer").ThrowAsJavaScriptException();
    return env.Null();
  }

  if (!info[0].IsBuffer()) {
    Napi::TypeError::New(env, "Image must be a Buffer").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();

  // Expect width and height as second and third arguments
  if (info.Length() < 3 || !info[1].IsNumber() || !info[2].IsNumber()) {
    Napi::TypeError::New(env, "Expected width and height as numbers").ThrowAsJavaScriptException();
    return env.Null();
  }

  int width = info[1].As<Napi::Number>().Int32Value();
  int height = info[2].As<Napi::Number>().Int32Value();

  // Create OpenCV Mat from buffer
  cv::Mat image;

  // Check if it's grayscale or color
  if (buffer.Length() == (size_t)(width * height)) {
    // Grayscale - clone to ensure we own the data
    cv::Mat temp(height, width, CV_8UC1, buffer.Data());
    image = temp.clone();
  } else if (buffer.Length() == (size_t)(width * height * 3)) {
    // RGB
    cv::Mat colorImage(height, width, CV_8UC3, buffer.Data());
    cv::cvtColor(colorImage, image, cv::COLOR_RGB2GRAY);
  } else if (buffer.Length() == (size_t)(width * height * 4)) {
    // RGBA
    cv::Mat colorImage(height, width, CV_8UC4, buffer.Data());
    cv::cvtColor(colorImage, image, cv::COLOR_RGBA2GRAY);
  } else {
    Napi::TypeError::New(env, "Invalid buffer size for given dimensions").ThrowAsJavaScriptException();
    return env.Null();
  }

  // Detect tags
  std::vector<AprilTags::TagDetection> detections = detector->extractTags(image);

  // Convert to JavaScript array
  Napi::Array result = Napi::Array::New(env, detections.size());

  for (size_t i = 0; i < detections.size(); i++) {
    const AprilTags::TagDetection& detection = detections[i];

    Napi::Object obj = Napi::Object::New(env);
    obj.Set("id", Napi::Number::New(env, detection.id));
    obj.Set("hammingDistance", Napi::Number::New(env, detection.hammingDistance));
    obj.Set("good", Napi::Boolean::New(env, detection.good));

    // Center
    Napi::Array center = Napi::Array::New(env, 2);
    center[uint32_t(0)] = Napi::Number::New(env, detection.cxy.first);
    center[uint32_t(1)] = Napi::Number::New(env, detection.cxy.second);
    obj.Set("center", center);

    // Corners
    Napi::Array corners = Napi::Array::New(env, 4);
    for (int j = 0; j < 4; j++) {
      Napi::Array corner = Napi::Array::New(env, 2);
      corner[uint32_t(0)] = Napi::Number::New(env, detection.p[j].first);
      corner[uint32_t(1)] = Napi::Number::New(env, detection.p[j].second);
      corners[uint32_t(j)] = corner;
    }
    obj.Set("corners", corners);

    // Homography
    Napi::Array homography = Napi::Array::New(env, 9);
    for (int row = 0; row < 3; row++) {
      for (int col = 0; col < 3; col++) {
        homography[uint32_t(row * 3 + col)] = Napi::Number::New(env, detection.homography(row, col));
      }
    }
    obj.Set("homography", homography);

    result[uint32_t(i)] = obj;
  }

  return result;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  AprilTagDetector::Init(env, exports);
  return exports;
}

NODE_API_MODULE(apriltags, Init)
