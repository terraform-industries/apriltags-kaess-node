cmake_minimum_required(VERSION 3.15)
project(apriltags-kaess-node)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Include Node-API wrappers
execute_process(
  COMMAND node -p "require('node-addon-api').include"
  WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
  OUTPUT_VARIABLE NODE_ADDON_API_DIR
)
string(REPLACE "\n" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})

# Build apriltags library
set(APRILTAGS_DIR ${CMAKE_SOURCE_DIR}/apriltags)

# Find OpenCV - prefer ARM Homebrew on Apple Silicon
if(APPLE)
  # Check for ARM Homebrew first (/opt/homebrew)
  if(EXISTS "/opt/homebrew/opt/opencv")
    set(OPENCV_BREW_PREFIX "/opt/homebrew/opt/opencv")
    set(OpenCV_DIR "${OPENCV_BREW_PREFIX}/lib/cmake/opencv4")
    message(STATUS "Using ARM Homebrew OpenCV at: ${OPENCV_BREW_PREFIX}")
  # Fall back to Intel Homebrew (/usr/local)
  elseif(EXISTS "/usr/local/opt/opencv")
    execute_process(
      COMMAND brew --prefix opencv
      OUTPUT_VARIABLE OPENCV_BREW_PREFIX
      OUTPUT_STRIP_TRAILING_WHITESPACE
      ERROR_QUIET
    )
    if(OPENCV_BREW_PREFIX)
      set(OpenCV_DIR "${OPENCV_BREW_PREFIX}/lib/cmake/opencv4")
      message(STATUS "Using Intel Homebrew OpenCV at: ${OPENCV_BREW_PREFIX}")
    endif()
  endif()
endif()

find_package(OpenCV REQUIRED)

# Find Eigen3
find_package(Eigen3 3.3 REQUIRED NO_MODULE)

# Apriltags source files
file(GLOB APRILTAGS_SOURCES
  "${APRILTAGS_DIR}/src/*.cc"
)

# Build the addon
add_library(${PROJECT_NAME} SHARED
  ${APRILTAGS_SOURCES}
  ${CMAKE_JS_SRC}
  src/binding.cc
)

set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

target_include_directories(${PROJECT_NAME} PRIVATE
  ${CMAKE_JS_INC}
  ${NODE_ADDON_API_DIR}
  ${APRILTAGS_DIR}
  ${APRILTAGS_DIR}/AprilTags
)

target_link_libraries(${PROJECT_NAME}
  ${CMAKE_JS_LIB}
  ${OpenCV_LIBS}
  Eigen3::Eigen
)

# Set rpath for runtime library loading
if(APPLE AND OPENCV_BREW_PREFIX)
  set_target_properties(${PROJECT_NAME} PROPERTIES
    BUILD_RPATH "${OPENCV_BREW_PREFIX}/lib"
    INSTALL_RPATH "${OPENCV_BREW_PREFIX}/lib"
  )
endif()

# Defines NAPI_VERSION
add_definitions(-DNAPI_VERSION=8)
