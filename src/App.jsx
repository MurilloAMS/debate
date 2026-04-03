import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'

import Transmissao from './js/transmissao'
import Login from './js/loginjs' // ajuste se o nome for diferente

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<h1>Página Inicial</h1>} />
        <Route path="/transmissao" element={<Transmissao />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App