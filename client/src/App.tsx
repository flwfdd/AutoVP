/*
 * @Author: flwfdd
 * @Date: 2025-03-26 16:22:09
 * @LastEditTime: 2025-04-16 02:11:26
 * @Description: _(:з」∠)_
 */
import { Route, Routes } from "react-router"
import FlowPage from "./pages/flow"
import { ThemeProvider } from "./components/theme-provider"
import { Toaster } from "sonner"

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <Routes>
        <Route path="/" element={<FlowPage />} />
      </Routes>
      <Toaster />
    </ThemeProvider>
  )
}

export default App
