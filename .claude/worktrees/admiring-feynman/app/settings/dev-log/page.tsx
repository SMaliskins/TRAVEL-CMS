"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DevLogRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/devlog");
  }, [router]);
  return null;
}
