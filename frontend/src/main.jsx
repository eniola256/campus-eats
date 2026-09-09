import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { CartProvider } from './CartContext.jsx';
import { CustomerAuthProvider } from './CustomerAuthContext.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <CustomerAuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </CustomerAuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);