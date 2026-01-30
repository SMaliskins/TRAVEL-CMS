"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md w-full rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950/30">
        <h2 className="text-xl font-semibold text-red-800 dark:text-red-200">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={() => reset()}
          className="mt-4 w-full rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
