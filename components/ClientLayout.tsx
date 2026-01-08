"use client";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <TopBar />
      {children}
    </>
  );
}





