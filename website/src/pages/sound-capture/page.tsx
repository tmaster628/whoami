import { MicrophoneIcon, StopCircleIcon } from "@heroicons/react/24/outline";
import { useMemo, useState } from "react";

export default function SoundCapture() {
  const [isRecording, setIsRecording] = useState(false);

  const recordButton = useMemo(() => {
    return isRecording ? (
      <StopCircleIcon
        role="button"
        width={36}
        className="p-1 rounded-full bg-red-400 color-black cursor-pointer"
        onClick={() => setIsRecording((prev) => !prev)}
      />
    ) : (
      <MicrophoneIcon
        role="button"
        width={36}
        className="p-2 rounded-full bg-red-400 color-black cursor-pointer"
        onClick={() => setIsRecording((prev) => !prev)}
      />
    );
  }, [isRecording, setIsRecording]);

  return (
    <div className="flex flex-col h-screen w-screen">
      <div className="items-center text-black">Sound capture page</div>
      <div className="flex items-center justify-center">{recordButton}</div>
    </div>
  );
}
