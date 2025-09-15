import { useState } from "react";
import { record3sPCM } from "./AudioRecord";
import { MicrophoneIcon } from "@heroicons/react/24/outline";

type RecordButtonProps = {
  setSamples: (Float32Array) => void;
  setSampleRate: (number) => void;
}

export default function RecordButton({setSamples, setSampleRate} : RecordButtonProps) {
  const [isRecording, setIsRecording] = useState(false);

  async function handleRecord() {
    setIsRecording(true);
    try {
      const { samples, sampleRate } = await record3sPCM(3);
      setSamples(samples);
      setSampleRate(sampleRate);
    } finally {
      setIsRecording(false);
    }
  }

 return (
    <>
      {isRecording ? (
        <>
      <MicrophoneIcon
        role="button"
        width={36}
        className="p-2 rounded-full bg-blue-400 color-black cursor-pointer"
        onClick={handleRecord}
      />
      <p>Recording...</p>
      </>
    ) : (
      <MicrophoneIcon
        role="button"
        width={36}
        className="p-2 rounded-full bg-red-400 color-black cursor-pointer"
        onClick={handleRecord}
      />
    )}
    </>
  );

}