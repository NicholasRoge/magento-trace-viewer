import React from 'react';
import TraceViewer from './TraceViewer'
import './App.scss';


const traceFileList = [
  '/trace/cached.xt',
  '/trace/uncached.xt'
]

export default function App() {
  const [traceFile, setTraceFile] = React.useState(traceFileList[0])

  return (
    <div className="app">
      <div>
        <select value={traceFile} onChange={e => setTraceFile(e.target.value)}>
          {traceFileList.map(file => (
            <option value={file} key={file}>
              {file.split('/').pop().slice(0, -'.xt'.length)}
            </option>
          ))}
        </select>
      </div>
      <TraceViewer traceFile={traceFile} />
    </div>
  );
}
