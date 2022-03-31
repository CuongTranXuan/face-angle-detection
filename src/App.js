import logo from './logo.svg';
import './App.css';
import Camera from './components/Camera';
import Haar from './components/Haar';
import Blazeface from './components/Blazeface'
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
    <Routes>
      {/* <Route path="/" element={<Camera />} /> */}
      <Route path="/haar" element={<Haar />} />
      <Route path="/blaze" element={<Blazeface />} />
    </Routes>
  </BrowserRouter>
  );
}

export default App;
