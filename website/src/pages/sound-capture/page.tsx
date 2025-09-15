import {  useState } from "react";
import RecordButton from "./RecordButton";
import AudioExplorer from "./AudioExplorer";

  export default function SoundCapture() {
    const [samples, setSamples] = useState<Float32Array<ArrayBufferLike>>();
    const [sampleRate, setSampleRate] = useState<number>();
  
  return (
    <div className="flex flex-col h-screen w-screen p-4">
       <h1 className="text-2xl font-semibold">Audio Explorer</h1>
       <p>Click the record button to record a 3-second audio sample. Then you'll be able to analyze it in the explorer tool!</p>
      <div className="flex items-center justify-center">
        <RecordButton setSamples={setSamples} setSampleRate={setSampleRate}/>
      </div>
      {samples && sampleRate && (
        <AudioExplorer samples={samples} sampleRate={sampleRate}/>
      )}
    </div>
  );
}
