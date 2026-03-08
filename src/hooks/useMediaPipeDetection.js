"use client";

/**
 * useMediaPipeDetection — IMAGE mode with canvas snapshots.
 * Suppresses MediaPipe's internal console.error INFO messages
 * that trigger Next.js error overlay.
 */

import { useRef, useEffect, useState } from "react";

const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/**
 * Suppress MediaPipe's internal INFO/WARNING messages that Next.js
 * error overlay incorrectly treats as errors.
 */
function silenceMediaPipe(fn) {
  const origError = console.error;
  const origWarn = console.warn;
  const origLog = console.log;

  console.error = (...args) => {
    const msg = args[0]?.toString?.() || "";
    if (
      msg.includes("Created TensorFlow Lite") ||
      msg.includes("INFO:") ||
      msg.includes("TfLite")
    )
      return;
    origError.apply(console, args);
  };
  console.warn = (...args) => {
    const msg = args[0]?.toString?.() || "";
    if (msg.includes("Created TensorFlow Lite") || msg.includes("INFO:"))
      return;
    origWarn.apply(console, args);
  };
  console.log = (...args) => {
    const msg = args[0]?.toString?.() || "";
    if (msg.includes("Created TensorFlow Lite") || msg.includes("INFO:"))
      return;
    origLog.apply(console, args);
  };

  try {
    return fn();
  } finally {
    console.error = origError;
    console.warn = origWarn;
    console.log = origLog;
  }
}

export function useMediaPipeDetection(videoElement, active) {
  const [hands, setHands] = useState([]);
  const [faceEmotion, setFaceEmotion] = useState("neutral");
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const handRef = useRef(null);
  const faceRef = useRef(null);
  const intervalRef = useRef(null);
  const canvasRef = useRef(null);
  const loadedRef = useRef(false);

  // Load models
  useEffect(() => {
    if (!active || loadedRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const mp = await import("@mediapipe/tasks-vision");

        // Suppress TFLite delegate INFO messages during init
        const wasm = await silenceMediaPipe(() =>
          mp.FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm",
          ),
        );

        const h = await silenceMediaPipe(() =>
          mp.HandLandmarker.createFromOptions(wasm, {
            baseOptions: { modelAssetPath: HAND_MODEL },
            runningMode: "IMAGE",
            numHands: 2,
          }),
        );

        const f = await silenceMediaPipe(() =>
          mp.FaceLandmarker.createFromOptions(wasm, {
            baseOptions: { modelAssetPath: FACE_MODEL },
            runningMode: "IMAGE",
            outputFaceBlendshapes: true,
          }),
        );

        if (!cancelled) {
          handRef.current = h;
          faceRef.current = f;
          loadedRef.current = true;
          setIsLoaded(true);
          console.log("[MediaPipe] Ready ✓");
        } else {
          h.close();
          f.close();
        }
      } catch (e) {
        console.warn("[MediaPipe] Load failed:", e.message);
        if (!cancelled) setLoadError(e.message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active]);

  // Detection loop
  useEffect(() => {
    if (!isLoaded || !videoElement || !active) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
      canvasRef.current.width = 320;
      canvasRef.current.height = 240;
    }

    const cvs = canvasRef.current;
    const ctx = cvs.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      if (
        !videoElement ||
        videoElement.paused ||
        videoElement.readyState < 2 ||
        videoElement.videoWidth < 1
      )
        return;

      try {
        ctx.drawImage(videoElement, 0, 0, 320, 240);
      } catch {
        return;
      }

      // Hands — silence the TFLite delegate messages
      try {
        const hr = silenceMediaPipe(() => handRef.current?.detect(cvs));
        if (hr?.landmarks?.length) {
          setHands(
            hr.landmarks.map((lms, i) => {
              let x0 = 1,
                y0 = 1,
                x1 = 0,
                y1 = 0;
              for (const p of lms) {
                if (p.x < x0) x0 = p.x;
                if (p.y < y0) y0 = p.y;
                if (p.x > x1) x1 = p.x;
                if (p.y > y1) y1 = p.y;
              }
              return {
                landmarks: lms,
                boundingBox: {
                  minX: Math.max(0, x0 - 0.03),
                  minY: Math.max(0, y0 - 0.03),
                  maxX: Math.min(1, x1 + 0.03),
                  maxY: Math.min(1, y1 + 0.03),
                },
                handedness:
                  hr.handednesses?.[i]?.[0]?.categoryName || "Unknown",
              };
            }),
          );
        } else {
          setHands([]);
        }
      } catch {
        // skip
      }

      // Face
      try {
        const fr = silenceMediaPipe(() => faceRef.current?.detect(cvs));
        if (fr?.faceBlendshapes?.length) {
          setFaceEmotion(readEmotion(fr.faceBlendshapes[0].categories));
        }
      } catch {
        // skip
      }
    };

    intervalRef.current = setInterval(tick, 200);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isLoaded, videoElement, active]);

  useEffect(
    () => () => {
      clearInterval(intervalRef.current);
      handRef.current?.close();
      faceRef.current?.close();
    },
    [],
  );

  return { hands, faceEmotion, isLoaded, loadError };
}

function readEmotion(bs) {
  const g = (n) => bs.find((b) => b.categoryName === n)?.score || 0;
  const smile = Math.max(g("mouthSmileLeft"), g("mouthSmileRight"));
  const frown = Math.max(g("mouthFrownLeft"), g("mouthFrownRight"));
  const browUp = g("browInnerUp");
  const browDn = Math.max(g("browDownLeft"), g("browDownRight"));
  const wide = Math.max(g("eyeWideLeft"), g("eyeWideRight"));
  const squint = Math.max(g("eyeSquintLeft"), g("eyeSquintRight"));

  if (smile > 0.5 && squint > 0.2) return "happy";
  if (smile > 0.7) return "excited";
  if (frown > 0.4 && browDn > 0.3) return "angry";
  if (browUp > 0.5 && wide > 0.4) return "surprised";
  if (frown > 0.3 && browUp > 0.4) return "concerned";
  if (frown > 0.3) return "sad";
  if (squint > 0.4 && smile < 0.2) return "pain";
  return "neutral";
}
