/*
 * @Author: flwfdd
 * @Date: 2025-01-17 21:43:17
 * @LastEditTime: 2025-02-07 14:15:20
 * @Description: _(:з」∠)_
 */
import { Link } from "@heroui/link";

import { Navbar } from "@/components/navbar";

export default function DefaultLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col h-screen">
      <Navbar />
      <main className="w-full mx-auto flex-grow">
        {children}
      </main>
    </div>
  );
}
