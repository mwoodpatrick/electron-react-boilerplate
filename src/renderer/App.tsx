import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
// import icon from '../../assets/icon.svg';
import logo from '../../assets/pos.png';
import './App.css';

const Hello = () => {
  return (
    <div>
      <div className="Hello">
        <img src={logo} alt="Park of the Sierras" />
      </div>
      <h1>MIB Reader</h1>
      <div className="Hello"> </div>
      <h2>GUI Coming Soon!</h2>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Hello />} />
      </Routes>
    </Router>
  );
}
