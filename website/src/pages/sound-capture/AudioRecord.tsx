// record3sPCM.ts
export async function record3sPCM(durationSec = 3): Promise<{
  samples: Float32Array;
  sampleRate: number;
}> {
  // 1) Ask for mic
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  // 2) Spin up AudioContext
    // eslint-disable-next-line
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  await ctx.resume();

  // 3) Create the worklet module on the fly via Blob URL
  const workletCode = `
    class RecorderProcessor extends AudioWorkletProcessor {
      process (inputs) {
        // inputs[0][0] is channel 0 of the first input node, 128 samples per render quantum
        const input = inputs[0];
        if (input && input[0]) {
          // Copy out a chunk so the main thread can keep it
          const chunk = input[0];
          const copy = new Float32Array(chunk.length);
          copy.set(chunk);
          this.port.postMessage(copy, [copy.buffer]); // transfer buffer for efficiency
        }
        return true; // keep running
      }
    }
    registerProcessor('recorder-processor', RecorderProcessor);
  `;
  const blob = new Blob([workletCode], { type: "application/javascript" });
  const workletURL = URL.createObjectURL(blob);
  await ctx.audioWorklet.addModule(workletURL);

  // 4) Wire up nodes
  const source = ctx.createMediaStreamSource(stream);
  const recorder = new AudioWorkletNode(ctx, "recorder-processor");

  // Keep the node "live" without feeding audio to speakers
  const silent = ctx.createGain();
  silent.gain.value = 0;

  source.connect(recorder);
  recorder.connect(silent);
  silent.connect(ctx.destination);

  // 5) Accumulate samples until we hit duration
  const sampleRate = ctx.sampleRate;
  const targetFrames = Math.ceil(durationSec * sampleRate);
  let collected = 0;
  const chunks: Float32Array[] = [];

  const done = new Promise<{ samples: Float32Array; sampleRate: number }>((resolve, reject) => {
    const onMsg = (e: MessageEvent<Float32Array>) => {
      const chunk = e.data;
      chunks.push(chunk);
      collected += chunk.length;

      if (collected >= targetFrames) {
        // Concatenate and trim to exact length
        const samples = new Float32Array(targetFrames);
        let offset = 0;
        for (const c of chunks) {
          const copyCount = Math.min(c.length, targetFrames - offset);
          samples.set(copyCount === c.length ? c : c.subarray(0, copyCount), offset);
          offset += copyCount;
          if (offset >= targetFrames) break;
        }

        cleanup();
        resolve({ samples, sampleRate });
      }
    };
    /* eslint-disable */
    const onError = (err: any) => {
      cleanup();
      reject(err);
    };

    recorder.port.onmessage = onMsg;
    recorder.port.onmessageerror = onError;

    function cleanup() {
      try {
        recorder.port.onmessage = null;
        recorder.port.onmessageerror = null;
        source.disconnect();
        recorder.disconnect();
        silent.disconnect();
      } catch {
        // Err
      }
      stream.getTracks().forEach(t => t.stop());
      ctx.close().catch(() => {});
      URL.revokeObjectURL(workletURL);
    }
  });

  return done;
}
