/*
 * @Author: flwfdd
 * @Date: 2025-01-17 21:43:17
 * @LastEditTime: 2025-02-07 14:03:28
 * @Description: _(:з」∠)_
 */
import { Route, Routes } from "react-router-dom";

import FlowPage from "@/pages/flow";

function App() {
  return (
    <Routes>
      <Route element={<FlowPage />} path="/" />
    </Routes>
  );
}

export default App;
