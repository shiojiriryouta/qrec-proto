"use client"
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WebGLRenderer, PerspectiveCamera, Scene, Clock, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { LumaSplatsThree } from "@lumaai/luma-web";
import * as faceapi from "face-api.js";

export default function LumaWithFaceTracking() {
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const clockRef = useRef(new Clock());
  const targetPosition = useRef(new Vector3(0, 1, 3)); // 目標カメラ位置
  const videoRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");

  useEffect(() => {
    if (!canvasRef.current) return;

    // Three.js シーン、カメラ、レンダラーのセットアップ
    const scene = new Scene();
    const camera = new PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 3);
    cameraRef.current = camera;

    const renderer = new WebGLRenderer({
      canvas: canvasRef.current,
      antialias: false,
    });
    renderer.setSize(window.innerWidth, window.innerHeight, false);

    const controls = new OrbitControls(camera, canvasRef.current);
    controls.enableDamping = true;

    const splat = new LumaSplatsThree({
      source: "https://lumalabs.ai/capture/f45a5f26-3b70-4bfa-9c7a-5d95a1df942f",
    });
    scene.add(splat);

    // レンダリングループ
    const animate = () => {
      requestAnimationFrame(animate);
      cameraRef.current.position.lerp(targetPosition.current, 0.05); // なめらか移動
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      scene.remove(splat);
    };
  }, []);

  // ✅ カメラデバイスのリストを取得
  useEffect(() => {
    async function getDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      setDevices(videoDevices);
      if (videoDevices.length > 0) {
        setSelectedDevice(videoDevices[0].deviceId); // 最初のカメラを選択
      }
    }
    getDevices();
  }, []);

  // ✅ 選択したカメラを使用する
  useEffect(() => {
    if (!selectedDevice) return;

    const startVideo = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedDevice } } // ✅ 外部カメラのデバイスIDを指定
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

          // ✅ 顔の位置に応じてカメラの移動を反転
          const normalizedX = -(centerX / displaySize.width - 0.5) * 4;
          const normalizedY = -(centerY / displaySize.width - 0.5) * 4;
          const normalizedZ = -(face.width / displaySize.width) * 8 + 4;

          targetPosition.current.set(normalizedX, normalizedY, 2);
        }
      }, 100);
    };
  }, [loading]);

  return (
    <div className="flex flex-col items-center">
      <Link href="/">
        <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold mt-5 py-2 px-4 rounded">
          元のページへ
        </button>
      </Link>

      {/* カメラ選択ドロップダウン */}
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
      {/* 顔認識エリア */}
      {loading && <p>モデルを読み込み中...</p>}
      <div className="relative">
        <video ref={videoRef} autoPlay muted className="hidden-video" />
        <canvas ref={faceCanvasRef} className="absolute top-0 left-0" />
      </div>

      {/* Three.js の 3D 表示 */}
      <canvas ref={canvasRef} className="w-full h-screen" />

    </div>
  );
}
