import React from 'react';
import TraceViewer from './TraceViewer'
import './App.css';


const traceFile = '/trace/1593791800_553473.xt'

function App() {

  return (
    <div className="app">
      <TraceViewer traceFile={traceFile} />
    </div>
  );
}

export default App;
