"use client";

import { useRouter } from "next/navigation";
import { useNavigationHistory } from "@/contexts/NavigationHistoryContext";

interface BackLinkProps {
  label?: string;
  className?: string;
}

const defaultClass = "text-sm text-blue-600 hover:text-blue-700 cursor-pointer";

export default function BackLink({ label = "← Back", className }: BackLinkProps) {
  const router = useRouter();
  const { canGoBack, goBack } = useNavigationHistory();
  const handleBack = () => (canGoBack ? goBack() : router.back());
  return (
    <button
      type="button"
      onClick={handleBack}
      className={className ?? defaultClass}
    >
      {label}
    </button>
  );
}
