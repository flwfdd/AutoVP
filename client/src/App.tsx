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
