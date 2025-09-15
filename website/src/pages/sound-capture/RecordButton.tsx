import { useState } from "react";
import { record3sPCM } from "./AudioRecord";
import { MicrophoneIcon, StopCircleIcon } from "@heroicons/react/24/outline";

type RecordButtonProps = {
  setSamples: (samples: Float32Array) => void;
  setSampleRate: (rate: number) => void;
};

export default function RecordButton({
  setSamples,
  setSampleRate,
}: RecordButtonProps) {
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
        <div className="flex flex-col gap-3">
          <StopCircleIcon
            role="button"
            width={200}
            className="p-2 rounded-full bg-red-500 color-black animate-spin"
            onClick={handleRecord}
          />
          <div className="items-start text-black">
            Recording for 3 seconds...{" "}
          </div>
        </div>
      ) : (
        <MicrophoneIcon
          role="button"
          width={200}
          className="p-2 rounded-full bg-red-500 color-black hover:bg-red-400 cursor-pointer"
          onClick={handleRecord}
        />
      )}
    </>
  );
}
