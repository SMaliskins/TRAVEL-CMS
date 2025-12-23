"use client";

import { ReactNode } from "react";
import { DirectoryProvider } from "@/lib/directory/directoryStore";

export default function DirectoryLayout({ children }: { children: ReactNode }) {
  return <DirectoryProvider>{children}</DirectoryProvider>;
}

