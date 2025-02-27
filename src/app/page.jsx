'use client';

import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import Link from "next/link";

export default function FaceDetection() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const startVideo = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    };

    const loadModels = async () => {
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      setLoading(false);
    };

    startVideo();
    loadModels();
  }, []);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    video.onloadedmetadata = () => {
      // ✅ ここで displaySize を定義
      const displaySize = { width: video.videoWidth, height: video.videoHeight };
      faceapi.matchDimensions(canvas, displaySize);

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions());
        
        // ✅ displaySize をここで参照
        if (displaySize.width === 0 || displaySize.height === 0) {
          console.warn("ビデオサイズが 0 のため、顔認識をスキップ");
          return;
        }

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, resizedDetections);
      }, 100);
    };
  }, [loading]);

  return (
    <div className="flex flex-col items-center">
      <Link href="/luma-test">
        <button className='bg-blue-500 hover:bg-blue-700 text-white font-bold mt-5 py-2 px-4 rounded'>
          Lumaのサイトへ
        </button>
      </Link>
      <h1 className="text-xl font-bold mb-4">顔認識デモ</h1>
      {loading && <p>モデルを読み込み中...</p>}
      <div className="relative">
        <video ref={videoRef} autoPlay muted className="border rounded" />
        <canvas ref={canvasRef} className="absolute top-0 left-0" />
      </div>
    </div>
  );
}
