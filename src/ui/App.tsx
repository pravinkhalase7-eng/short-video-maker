import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VideoList from './pages/VideoList';
import VideoCreator from './pages/VideoCreator';
import VideoDetails from './pages/VideoDetails';
import BrollLibrary from './pages/BrollLibrary';
import Layout from './components/Layout';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<VideoList />} />
          <Route path="/create" element={<VideoCreator />} />
          <Route path="/broll" element={<BrollLibrary />} />
          <Route path="/video/:videoId" element={<VideoDetails />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App; 