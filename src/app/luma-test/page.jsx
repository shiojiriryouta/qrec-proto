"use client"
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WebGLRenderer, PerspectiveCamera, Scene, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { LumaSplatsThree } from "@lumaai/luma-web";
import * as faceapi from "face-api.js";

export default function LumaWithFaceTracking() {
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const videoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = new Scene();
    const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 7);
    cameraRef.current = camera;

    const renderer = new WebGLRenderer({
      canvas: canvasRef.current,
      antialias: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.screenSpacePanning = true;
    controls.enableRotate = false;
    controlsRef.current = controls;

    const splat = new LumaSplatsThree({
      source: "https://lumalabs.ai/capture/8c21729b-eed9-479e-8d21-68c35035b47b",
    });
    splat.position.set(0, 1, -5.0);
    scene.add(splat);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      scene.remove(splat);
    };
  }, []);

  useEffect(() => {
    async function getDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedDevice(videoDevices[0].deviceId);
      }
    }
    getDevices();
  }, []);

  useEffect(() => {
    if (!selectedDevice) return;

    const startVideo = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedDevice } }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    };

    const loadModels = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      setLoading(false);
    };

    startVideo();
    loadModels();
  }, [selectedDevice]);

  useEffect(() => {
    if (!videoRef.current || !faceCanvasRef.current) return;

    const video = videoRef.current;
    const canvas = faceCanvasRef.current;
    video.onloadedmetadata = () => {
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
      
        if (detections.length > 0) {
          const face = detections[0].box;
          const centerX = face.x + face.width / 2;
          const centerY = face.y + face.height / 2;
        
          // ✅ 正規化（-0.5 ~ 0.5 の範囲）
          const normalizedX = (0.5 - centerX / displaySize.width) * 1.0;
          const normalizedY = -(centerY / displaySize.height - 0.5) * 1.0;
        
          // ✅ カメラの位置を更新（顔の位置に応じてカメラを移動）
          const targetCameraX = normalizedX * 2.0;
          const targetCameraY = 2 + normalizedY * 1.5;
          const targetCameraZ = 5.0 - Math.abs(normalizedX) * 1.5;
        
          if (cameraRef.current && controlsRef.current) {
            cameraRef.current.position.lerp(new Vector3(targetCameraX, targetCameraY, targetCameraZ), 0.02);
        
            const smoothedTargetX = -controlsRef.current.target.x * 0.9 + targetCameraX * 0.1;
            const smoothedTargetY = controlsRef.current.target.y * 0.9 + targetCameraY * 0.1;
        
            cameraRef.current.lookAt(new Vector3(smoothedTargetX, smoothedTargetY, 0));
        
            controlsRef.current.target.set(smoothedTargetX, smoothedTargetY, 0);
            controlsRef.current.update();
        
            // ✅ ここでFOVを変更（新規追加）
            const faceSize = Math.min(face.width, face.height);
            const targetFov = Math.min(40 + faceSize * 1.0, 50); // FOV: 40 〜 50
        
            cameraRef.current.fov = cameraRef.current.fov * 0.9 + targetFov * 0.1;
            cameraRef.current.updateProjectionMatrix();
          }
        }
        
      }, 30);
      
    };
  }, [loading]);

  return (
    <div className="flex flex-col items-center">
      <Link href="/">
        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold mt-5 py-2 px-4 rounded">
          元のページへ
        </button>
      </Link>

      <div className="my-4">
        <label className="mr-2">カメラを選択:</label>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="border p-2"
        >
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `カメラ ${device.deviceId}`}
            </option>
          ))}
        </select>
      </div>
      {loading && <p>モデルを読み込み中...</p>}
      <div className="relative">
        <video ref={videoRef} autoPlay muted className="hidden-video" />
        <canvas ref={faceCanvasRef} className="absolute top-0 left-0" />
      </div>

      <canvas ref={canvasRef} className="w-full h-screen" />
    </div>
  );
}
