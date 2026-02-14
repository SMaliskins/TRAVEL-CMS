"use client";

import { useRouter } from "next/navigation";

interface BackLinkProps {
  label?: string;
  className?: string;
}

const defaultClass = "text-sm text-blue-600 hover:text-blue-700 cursor-pointer";

export default function BackLink({ label = "← Back", className }: BackLinkProps) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={className ?? defaultClass}
    >
      {label}
    </button>
  );
}
