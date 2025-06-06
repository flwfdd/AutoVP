import FlowPage from "@/pages/Flow"
import { Route, Routes } from "react-router"
import { Toaster } from "sonner"
import { ThemeProvider } from "./components/theme-provider"

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <Routes>
        <Route path="/" element={<FlowPage />} />
      </Routes>
      <Toaster position="top-right" />
    </ThemeProvider>
  )
}

export default App
