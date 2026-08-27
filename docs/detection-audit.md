# Detection Audit

The original repository used three important behavior contracts. Face API loaded SSD MobileNet v1 and the tiny landmark model from `/models`, used `minConfidence = 0.5`, `maxResults = 2`, `useTinyModel = true`, a 480 × 480 camera, and a 500 ms detection interval. The refactor retained the confidence value and interval family but omitted the explicit `maxResults` setting and changed the model-loading API to the equivalent `nets.*.loadFromUri` calls.

OpenCV Haar originally called `detectMultiScale(gray, faces, 1.2, 3, 0, new cv.Size(70))`; the current refactor retained the same scale factor, min-neighbor threshold, flags, and minimum size.

The original NCNN call signature was `Module._blazeface_ncnn(dst, canvas.width, canvas.height, resultbuffer)`. The current refactor reversed the input pointer and dimensions as `module._blazeface_ncnn(CANVAS_WIDTH, CANVAS_HEIGHT, memoryRef.current.dst, memoryRef.current.resultBuffer)`, which is a concrete regression and can prevent any face result. The current Face API and Haar surfaces also do not paint the live video image into their output canvas, so a successful detector can appear blank except for overlays. The fix should restore the original NCNN argument order, preserve all thresholds, and draw the video frame beneath detector overlays.
