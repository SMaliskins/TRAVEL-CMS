"use client";

import { useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, ImageOff } from "lucide-react";

interface ImageGalleryProps {
  images: string[];
  hotelName: string;
}

export function ImageGallery({ images, hotelName }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const hasImages = images.length > 0;

  const navigate = useCallback(
    (dir: 1 | -1) => {
      if (!hasImages) return;
      setActiveIndex((prev) => (prev + dir + images.length) % images.length);
    },
    [hasImages, images.length]
  );

  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen, navigate]);

  if (!hasImages) {
    return (
      <div className="w-full aspect-[16/9] rounded-xl bg-slate-100 flex flex-col items-center justify-center text-slate-400 gap-2">
        <ImageOff className="w-10 h-10" />
        <span className="text-sm">No images available</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div
          className="relative w-full aspect-[16/9] rounded-xl overflow-hidden cursor-pointer group"
          onClick={() => setFullscreen(true)}
        >
          <img
            src={images[activeIndex]}
            alt={`${hotelName} - ${activeIndex + 1}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          <span className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
            {activeIndex + 1} / {images.length}
          </span>
        </div>

        {images.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {images.slice(0, 4).map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                className={`relative w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 transition-all
                  ${activeIndex === i ? "ring-2 ring-indigo-500 ring-offset-1" : "opacity-70 hover:opacity-100"}`}
              >
                <img
                  src={img}
                  alt={`${hotelName} thumbnail ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
            {images.length > 4 && (
              <button
                onClick={() => {
                  setActiveIndex(4);
                  setFullscreen(true);
                }}
                className="w-20 h-14 rounded-lg bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-medium flex-shrink-0 hover:bg-slate-300 transition-colors"
              >
                +{images.length - 4}
              </button>
            )}
          </div>
        )}
      </div>

      {fullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-in fade-in duration-200"
          onClick={() => setFullscreen(false)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white z-10 p-2"
            onClick={() => setFullscreen(false)}
          >
            <X className="w-6 h-6" />
          </button>

          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2 z-10"
            onClick={(e) => {
              e.stopPropagation();
              navigate(-1);
            }}
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <img
            src={images[activeIndex]}
            alt={`${hotelName} - ${activeIndex + 1}`}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2 z-10"
            onClick={(e) => {
              e.stopPropagation();
              navigate(1);
            }}
          >
            <ChevronRight className="w-8 h-8" />
          </button>

          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {activeIndex + 1} / {images.length}
          </span>
        </div>
      )}
    </>
  );
}
