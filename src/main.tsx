// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import './index.css'
// import App from './App.tsx'

// createRoot(document.getElementById('root')!).render(
//   // <StrictMode>
//     <App />
//   // </StrictMode>,
// )

// import React from 'react'
// import ReactDOM from 'react-dom/client'
// import App from './App.tsx'
// import './index.css'
// // ✨ 여기! init을 중괄호로 감싸서 'named import' 방식으로 변경합니다.
// import { init } from '@dimforge/rapier3d-compat'

// // ✨ 1. 앱을 실행하기 전에, 물리 엔진(rapier)을 먼저 불러와서 준비시킵니다.
// init().then(() => {
//   // ✨ 2. 물리 엔진 준비가 성공적으로 끝나면, 그 때 React 앱을 실행합니다!
//   ReactDOM.createRoot(document.getElementById('root')!).render(
//     <React.StrictMode>
//       <App />
//     </React.StrictMode>,
//   )
// });

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { init } from '@dimforge/rapier3d-compat';

// 물리 엔진을 먼저 로드하고, 성공하면 React 앱을 실행합니다.
init().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
