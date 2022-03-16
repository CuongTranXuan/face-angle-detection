import logo from './logo.svg';
import './App.css';
import Camera from './components/Camera';
import Haar from './components/Haar';
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
    <Routes>
      <Route path="/" element={<Camera />} />
      <Route path="/haar" element={<Haar />} />
    </Routes>
  </BrowserRouter>
  );
}

export default App;
