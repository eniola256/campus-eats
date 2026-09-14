import { Outlet } from 'react-router-dom';
import './PublicLayout.css';
import Navbar from '../components/Navbar.jsx';

export default function PublicLayout() {
  return (
    <div className="public-layout">
      <Navbar />
      <Outlet />
    </div>
  );
}