import React from 'react';
import TraceViewer from './TraceViewer'
import './App.scss';

import mageTraceFiles from './mage-trace-files'


const traceFileList = [
  ...mageTraceFiles.map(file => `http://racksolutions.ifi/media/trace/${file}`),
  '/trace/cached.xt',
  '/trace/uncached.xt',
]

export default function App() {
  const [traceFile, setTraceFile] = React.useState('')

  return (
    <div className="app">
      <div>
        <select value={traceFile} onChange={e => setTraceFile(e.target.value)}>
          <option value={''}> -- Select an Trace File --</option>
          {traceFileList.map(file => (
            <option value={file} key={file}>
              {file.split('/').pop().slice(0, -'.xt'.length)}
            </option>
          ))}
        </select>
      </div>
      {traceFile && <TraceViewer traceFile={traceFile} />}
    </div>
  );
}
