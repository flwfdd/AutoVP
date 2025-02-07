/*
 * @Author: flwfdd
 * @Date: 2025-01-17 21:43:17
 * @LastEditTime: 2025-02-07 13:55:44
 * @Description: _(:з」∠)_
 */
import type { NavigateOptions } from "react-router-dom";

import { HeroUIProvider } from "@heroui/system";
import { useHref, useNavigate } from "react-router-dom";
import { ThemeProvider } from "./hooks/use-theme";
import { Toaster } from "sonner";

declare module "@react-types/shared" {
  interface RouterConfig {
    routerOptions: NavigateOptions;
  }
}

export function Provider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  return (
    <HeroUIProvider navigate={navigate} useHref={useHref}>
      <Toaster position="bottom-center" richColors />
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </HeroUIProvider>
  );
}
