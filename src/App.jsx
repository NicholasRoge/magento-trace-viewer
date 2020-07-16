import React from 'react';
import TraceViewer from './TraceViewer'
import './App.scss';


const traceFile = '/trace/cached.xt'

export default function App() {
  return (
    <div className="app">
      <TraceViewer traceFile={traceFile} />
    </div>
  );
}
