import ReactQueryProvider from "@/components/providers/ReactQueryProvider";

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return <ReactQueryProvider>{children}</ReactQueryProvider>;
}
