import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * AudioExplorer
 * Props:
 *  - samples: Float32Array  (mono PCM in [-1,1])
 *  - sampleRate: number     (Hz)
 *
 * Renders three switchable views:
 *  1) Time-domain waveform
 *  2) Frequency spectrum (FFT with Hann window + zero-padding)
 *  3) Sampling & quantization demo with binary output preview
 *
 * No external UI libs required; styled with Tailwind.
 */
export default function AudioExplorer({
  samples,
  sampleRate,
}: {
  samples: Float32Array;
  sampleRate: number;
}) {
  const tabs = ["Waveform", "Spectrum", "Sampling", "FFT Window"] as const;
  const [tab, setTab] = useState<(typeof tabs)[number]>("Waveform");

  return (
    <div className="w-full max-w-5xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
         
          <p className="text-sm text-gray-500">
            {samples.length} samples @ {sampleRate.toLocaleString()} Hz (~
            {(samples.length / sampleRate).toFixed(2)}s)
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          {tabs.map((t) => (
            <button
              key={t}
              className={
                "px-3 py-1.5 text-sm rounded-lg transition " +
                (tab === t
                  ? "!bg-blue-800 shadow font-medium"
                  : "text-gray-200 hover:text-gray-500")
              }
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {tab === "Waveform" && (
        <Card>
          <WaveformCanvas samples={samples} sampleRate={sampleRate} />
        </Card>
      )}

      {tab === "Spectrum" && (
        <Card>
          <SpectrumCanvas samples={samples} sampleRate={sampleRate} />
        </Card>
      )}

      {tab === "Sampling" && (
        <Card>
          <SamplingCanvas samples={samples} sampleRate={sampleRate} />
        </Card>
      )}
      {tab === "FFT Window" && (
        <Card>
            <WindowFFTCanvas samples={samples} sampleRate={sampleRate} />
        </Card>
      ) }
    </div>
  );
}

function Card({ children }: React.PropsWithChildren) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-3">
      {children}
    </div>
  );
}

/**********************
 * 1) Waveform View   *
 **********************/
function WaveformCanvas({
  samples,
  sampleRate,
}: {
  samples: Float32Array;
  sampleRate: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Time window (zoom) in milliseconds, and pan (start sample)
  const fullMs = Math.max(1, Math.round((samples.length / sampleRate) * 1000));
  const [winMs, setWinMs] = useState(Math.min(3000, fullMs)); // default ~3s or full
  const [startSample, setStartSample] = useState(0);

  // Optional styling toggles
  const [showZero, setShowZero] = useState(true);

  // Derived window math
  const windowSamples = Math.max(
    256,
    Math.min(samples.length, Math.floor((winMs / 1000) * sampleRate))
  );
  const clampedStart = Math.max(0, Math.min(startSample, Math.max(0, samples.length - windowSamples)));
  const endSample = clampedStart + windowSamples;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = 300 * dpr;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // clear
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Axes padding
    const leftPad = 48 * dpr;
    const bottomPad = 22 * dpr;
    const plotW = w - leftPad - 8 * dpr;
    const plotH = h - bottomPad - 6 * dpr;
    const plotX0 = leftPad;
    const plotY0 = 6 * dpr;

    // Draw plot frame
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = Math.max(1, dpr);
    ctx.strokeRect(plotX0, plotY0, plotW, plotH);

    // Y ticks (-1 to +1)
    ctx.strokeStyle = "#f3f4f6";
    ctx.fillStyle = "#6b7280";
    ctx.font = `${11 * dpr}px ui-sans-serif, system-ui`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const yTicks = [-1, -0.5, 0, 0.5, 1];
    for (const t of yTicks) {
      const y = plotY0 + (1 - (t + 1) / 2) * plotH;
      ctx.beginPath();
      ctx.moveTo(plotX0, y + 0.5);
      ctx.lineTo(plotX0 + plotW, y + 0.5);
      ctx.stroke();
      ctx.fillText(t.toFixed(1), plotX0 - 6 * dpr, y);
    }
    // Y label
    ctx.save();
    ctx.translate(14 * dpr, plotY0 + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Amplitude", 0, 0);
    ctx.restore();

    // X ticks (time in seconds)
    const startTime = clampedStart / sampleRate;
    const endTimeSec = endSample / sampleRate;
    const dur = endTimeSec - startTime;

    // choose a “nice” tick step (0.001, 0.002, 0.005 * 10^k)
    const niceStep = (range: number) => {
      const raw = range / 8; // aim ~8 ticks
      const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
      const candidates = [1, 2, 5].map((m) => m * pow10);
      // also include sub-ms if tiny windows
      const more = [0.2, 0.5].map((m) => m * pow10);
      const all = [...candidates, ...more].sort((a, b) => a - b);
      // pick the smallest >= raw
      return all.find((s) => s >= raw) ?? candidates[candidates.length - 1];
    };
    const xStep = niceStep(dur);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (
      let t = Math.ceil(startTime / xStep) * xStep;
      t <= endTimeSec + 1e-12;
      t += xStep
    ) {
      const x = plotX0 + ((t - startTime) / dur) * plotW;
      ctx.strokeStyle = "#f3f4f6";
      ctx.beginPath();
      ctx.moveTo(x + 0.5, plotY0);
      ctx.lineTo(x + 0.5, plotY0 + plotH);
      ctx.stroke();
      ctx.fillStyle = "#6b7280";
      ctx.fillText(t.toFixed(dur < 1 ? 3 : 2) + " s", x, plotY0 + plotH + 4 * dpr);
    }
    // X label
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("Time (s)", plotX0 + plotW, h - 2 * dpr);

    // Optional zero line
    if (showZero) {
      const y0 = plotY0 + plotH / 2;
      ctx.strokeStyle = "#e5e7eb";
      ctx.beginPath();
      ctx.moveTo(plotX0, y0 + 0.5);
      ctx.lineTo(plotX0 + plotW, y0 + 0.5);
      ctx.stroke();
    }

    // Waveform: min–max envelope per column in the visible window
    const visible = samples.subarray(clampedStart, endSample);
    const cols = Math.max(1, Math.floor(plotW));
    const step = Math.max(1, Math.floor(visible.length / cols));
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    for (let c = 0, i = 0; c < cols; c++, i += step) {
      const i0 = Math.min(visible.length, i);
      const i1 = Math.min(visible.length, i + step);
      if (i0 >= i1) break;
      let vmin = 1,
        vmax = -1;
      for (let j = i0; j < i1; j++) {
        const v = visible[j];
        if (v < vmin) vmin = v;
        if (v > vmax) vmax = v;
      }
      const x = plotX0 + c + 0.5;
      const y1 = plotY0 + (1 - (vmin + 1) / 2) * plotH;
      const y2 = plotY0 + (1 - (vmax + 1) / 2) * plotH;
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }
    ctx.stroke();
  }, [samples, sampleRate, winMs, startSample, showZero]);

  // keep pan in range when zoom changes
  useEffect(() => {
    setStartSample((s) =>
      Math.max(0, Math.min(s, Math.max(0, samples.length - windowSamples)))
    );
  }, [windowSamples, samples.length]);

  // convenience display
  const startTime = clampedStart / sampleRate;
  const endTimeSec = endSample / sampleRate;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
        <label className="flex items-center gap-2">
          <span>Zoom (window):</span>
          <input
            type="range"
            min={10}
            max={fullMs}
            step={10}
            value={winMs}
            onChange={(e) => setWinMs(parseInt(e.target.value))}
          />
          <span className="tabular-nums w-20 text-right">{winMs} ms</span>
        </label>

        <label className="flex items-center gap-2">
          <span>Pan:</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, samples.length - windowSamples)}
            step={Math.max(1, Math.floor(windowSamples / 100))}
            value={clampedStart}
            onChange={(e) => setStartSample(parseInt(e.target.value))}
          />
          <span className="tabular-nums w-36 text-right">
            {startTime.toFixed(3)}–{endTimeSec.toFixed(3)} s
          </span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showZero}
            onChange={(e) => setShowZero(e.target.checked)}
          />
          <span>Zero line</span>
        </label>

        <span className="ml-auto text-gray-500">
          {samples.length.toLocaleString()} samples @{" "}
          {sampleRate.toLocaleString()} Hz
        </span>
      </div>

      <div className="w-full">
        <canvas ref={canvasRef} className="w-full h-[300px]" />
      </div>
    </div>
  );
}


/************************\n * 2) Spectrum (FFT)     *
 ************************/
function SpectrumCanvas({
  samples,
  sampleRate,
}: {
  samples: Float32Array;
  sampleRate: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fftSize, setFftSize] = useState(() =>
    nextPow2(Math.min(samples.length, 1 << 15))
  );
  const [logScale, setLogScale] = useState(true);
  const [windowing, setWindowing] = useState<"hann" | "none">("hann");

  // ---- Zoom & Pan (in Hz) ----
  const nyquist = sampleRate / 2;
  const [winHz, setWinHz] = useState<number>(nyquist); // window width
  const [startHz, setStartHz] = useState<number>(0);   // left edge
  const endHz = Math.min(nyquist, startHz + winHz);

  // Clamp pan whenever zoom changes
  useEffect(() => {
    setStartHz((s) => Math.max(0, Math.min(s, Math.max(0, nyquist - winHz))));
  }, [winHz, nyquist]);

  const { mags, binHz } = useMemo(() => {
    const N = fftSize;
    const x = new Float64Array(N);
    const copyCount = Math.min(N, samples.length);
    for (let i = 0; i < copyCount; i++) x[i] = samples[i];

    if (windowing === "hann") applyHann(x);

    const { re, im } = fftComplex(x);
    const half = Math.floor(N / 2);
    const mags = new Float64Array(half);
    for (let k = 0; k < half; k++) {
      mags[k] = Math.hypot(re[k], im[k]);
    }
    for (let k = 0; k < half; k++) mags[k] = (mags[k] * 2) / N;
    return { mags, binHz: sampleRate / N };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, sampleRate, fftSize, windowing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = 320 * dpr;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Plot rect with margins
    const leftPad = 54 * dpr;
    const bottomPad = 24 * dpr;
    const plotX = leftPad;
    const plotY = 6 * dpr;
    const plotW = w - leftPad - 8 * dpr;
    const plotH = h - bottomPad - 6 * dpr;

    const f0 = startHz;
    const f1 = endHz;
    const fRange = Math.max(1e-6, f1 - f0);

    const xFromHz = (f: number) => plotX + ((f - f0) / fRange) * plotW;
    const yFromMag = (m: number, maxMag: number) => {
      if (logScale) {
        const db = 20 * Math.log10(m / maxMag + 1e-12);
        const minDb = -80;
        const t = (db - minDb) / (0 - minDb);
        return plotY + (1 - Math.max(0, Math.min(1, t))) * (plotH - 2 * dpr);
      } else {
        const t = m / (maxMag || 1e-12);
        return plotY + (1 - Math.max(0, Math.min(1, t))) * (plotH - 2 * dpr);
      }
    };

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Frame
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = Math.max(1, dpr);
    ctx.strokeRect(plotX, plotY, plotW, plotH);

    // X ticks (Hz), choose a nice step
    const niceStep = (range: number) => {
      const raw = range / 8;
      const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
      const cands = [1, 2, 5].map((m) => m * pow10);
      const more = [0.25, 0.5].map((m) => m * pow10);
      const all = [...cands, ...more].sort((a, b) => a - b);
      return all.find((s) => s >= raw) ?? cands[cands.length - 1];
    };
    const stepHz = niceStep(fRange);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#6b7280";
    ctx.font = `${11 * dpr}px ui-sans-serif, system-ui`;

    for (
      let f = Math.ceil(f0 / stepHz) * stepHz;
      f <= f1 + 1e-6;
      f += stepHz
    ) {
      const x = xFromHz(f);
      ctx.strokeStyle = "#f3f4f6";
      ctx.beginPath();
      ctx.moveTo(x + 0.5, plotY);
      ctx.lineTo(x + 0.5, plotY + plotH);
      ctx.stroke();
      ctx.fillText(`${Math.round(f)}`, x, plotY + plotH + 4 * dpr);
    }

    // Y label
    ctx.save();
    ctx.translate(16 * dpr, plotY + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(logScale ? "Magnitude (dB rel. max)" : "Magnitude (rel.)", 0, 0);
    ctx.restore();

    // Draw spectrum within [f0, f1]
    const half = mags.length;
    const maxMag = mags.reduce((m, v) => (v > m ? v : m), 1e-12);
    const kStart = Math.max(0, Math.floor(f0 / binHz));
    const kEnd = Math.min(half - 1, Math.ceil(f1 / binHz));

    ctx.beginPath();
    ctx.strokeStyle = "#0f172a";
    let first = true;
    let peakMag = -Infinity;
    let peakIdx = kStart;

    for (let k = kStart; k <= kEnd; k++) {
      const f = k * binHz;
      const x = xFromHz(f);
      const mag = mags[k];
      const y = yFromMag(mag, maxMag);

      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }

      if (mag > peakMag) {
        peakMag = mag;
        peakIdx = k;
      }
    }
    ctx.stroke();

    // Peak marker + label
    if (kEnd >= kStart) {
      const fPeak = peakIdx * binHz;
      const xPeak = xFromHz(fPeak);
      const yPeak = yFromMag(mags[peakIdx], maxMag);

      // marker
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(xPeak, yPeak, 3 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // label
      ctx.fillStyle = "#ef4444";
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      const label = `${fPeak.toFixed(1)} Hz`;
      ctx.fillText(label, Math.min(xPeak + 6 * dpr, plotX + plotW - 30 * dpr), Math.max(yPeak - 6 * dpr, plotY + 10 * dpr));
    }

    // Axis captions
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("Frequency (Hz)", plotX + plotW, h - 2 * dpr);
  }, [mags, binHz, logScale, sampleRate, startHz, endHz]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
        <label className="flex items-center gap-2">
          <span>FFT size:</span>
          <select
            className="border rounded px-2 py-1"
            value={fftSize}
            onChange={(e) => setFftSize(parseInt(e.target.value))}
          >
            {[1024, 2048, 4096, 8192, 16384, 32768]
              .filter((n) => n <= 1 << 15)
              .map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span>Window:</span>
          <select
            className="border rounded px-2 py-1"
            value={windowing}
            // eslint-disable-next-line
            onChange={(e) => setWindowing(e.target.value as any)}
          >
            <option value="hann">Hann</option>
            <option value="none">None</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={logScale}
            onChange={(e) => setLogScale(e.target.checked)}
          />
          <span>Log (dB) scale</span>
        </label>

        {/* Zoom & Pan */}
        <label className="flex items-center gap-2">
          <span>Zoom (Hz):</span>
          <input
            type="range"
            min={Math.max(50, Math.round(nyquist / 200))}
            max={Math.round(nyquist)}
            step={Math.max(10, Math.round(nyquist / 500))}
            value={winHz}
            onChange={(e) => setWinHz(parseInt(e.target.value))}
          />
          <span className="tabular-nums w-20 text-right">{Math.round(winHz)} Hz</span>
        </label>

        <label className="flex items-center gap-2">
          <span>Pan (start Hz):</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, Math.round(nyquist - winHz))}
            step={Math.max(1, Math.round(binHz))}
            value={Math.min(startHz, nyquist - winHz)}
            onChange={(e) => setStartHz(parseInt(e.target.value))}
          />
          <span className="tabular-nums w-20 text-right">{Math.round(startHz)} Hz</span>
        </label>

        <span className="ml-auto text-gray-500">
          Bin ≈ {binHz.toFixed(1)} Hz · View {Math.round(startHz)}–{Math.round(endHz)} Hz
        </span>
      </div>

      <canvas ref={canvasRef} className="w-full h-[320px]" />
    </div>
  );
}


/*************************************\n * 3) Sampling & Quantization Demo   *
 *************************************/
function SamplingCanvas({
  samples,
  sampleRate,
}: {
  samples: Float32Array;
  sampleRate: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [targetRate, setTargetRate] = useState(8000); // Hz
  const [bits, setBits] = useState(8);                // PCM bits
  const [showZero, setShowZero] = useState(true);

  // --- X-axis zoom & pan (time window) ---
  const fullMs = Math.max(1, Math.round((samples.length / sampleRate) * 1000));
  const [winMs, setWinMs] = useState(Math.min(750, fullMs)); // default ~0.75s
  const windowSamples = Math.max(
    256,
    Math.min(samples.length, Math.floor((winMs / 1000) * sampleRate))
  );
  const [startSample, setStartSample] = useState(0);
  const clampedStart = Math.max(
    0,
    Math.min(startSample, Math.max(0, samples.length - windowSamples))
  );
  const endSample = clampedStart + windowSamples;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = 320 * dpr;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --- Plot geometry ---
    const leftPad = 48 * dpr;
    const bottomPad = 22 * dpr;
    const plotW = w - leftPad - 8 * dpr;
    const plotH = h - bottomPad - 6 * dpr;
    const plotX0 = leftPad;
    const plotY0 = 6 * dpr;

    const startTime = clampedStart / sampleRate;
    const endTimeSec = endSample / sampleRate;
    const dur = Math.max(1e-9, endTimeSec - startTime);

    const pxY = (v: number) => plotY0 + (1 - (v + 1) / 2) * plotH; // v in [-1,1]
    const pxXFromT = (t: number) => plotX0 + ((t - startTime) / dur) * plotW;

    // --- Clear & frame ---
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = Math.max(1, dpr);
    ctx.strokeRect(plotX0, plotY0, plotW, plotH);

    // --- Y ticks ---
    ctx.strokeStyle = "#f3f4f6";
    ctx.fillStyle = "#6b7280";
    ctx.font = `${11 * dpr}px ui-sans-serif, system-ui`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    const yTicks = [-1, -0.5, 0, 0.5, 1];
    for (const t of yTicks) {
      const y = pxY(t);
      ctx.beginPath();
      ctx.moveTo(plotX0, y + 0.5);
      ctx.lineTo(plotX0 + plotW, y + 0.5);
      ctx.stroke();
      ctx.fillText(t.toFixed(1), plotX0 - 6 * dpr, y);
    }
    // Y label
    ctx.save();
    ctx.translate(14 * dpr, plotY0 + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Amplitude", 0, 0);
    ctx.restore();

    // --- X ticks (nice step) ---
    const niceStep = (range: number) => {
      const raw = range / 8; // ~8 ticks
      const pow10 = Math.pow(10, Math.floor(Math.log10(raw)));
      const candidates = [1, 2, 5].map((m) => m * pow10);
      const more = [0.2, 0.5].map((m) => m * pow10);
      const all = [...candidates, ...more].sort((a, b) => a - b);
      return all.find((s) => s >= raw) ?? candidates[candidates.length - 1];
    };
    const xStep = niceStep(dur);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (
      let t = Math.ceil(startTime / xStep) * xStep;
      t <= endTimeSec + 1e-12;
      t += xStep
    ) {
      const x = pxXFromT(t);
      ctx.strokeStyle = "#f3f4f6";
      ctx.beginPath();
      ctx.moveTo(x + 0.5, plotY0);
      ctx.lineTo(x + 0.5, plotY0 + plotH);
      ctx.stroke();
      ctx.fillStyle = "#6b7280";
      ctx.fillText(
        (t).toFixed(dur < 1 ? 3 : 2) + " s",
        x,
        plotY0 + plotH + 4 * dpr
      );
    }
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("Time (s)", plotX0 + plotW, h - 2 * dpr);

    // --- Zero line ---
    if (showZero) {
      ctx.strokeStyle = "#e5e7eb";
      const zy = pxY(0);
      ctx.beginPath();
      ctx.moveTo(plotX0, zy + 0.5);
      ctx.lineTo(plotX0 + plotW, zy + 0.5);
      ctx.stroke();
    }

    // --- Original waveform (light, per-pixel envelope) ---
    const visible = samples.subarray(clampedStart, endSample);
    const cols = Math.max(1, Math.floor(plotW));
    const stepOrig = Math.max(1, Math.floor(visible.length / cols));
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath();
    for (let c = 0, i = 0; c < cols; c++, i += stepOrig) {
      const i0 = Math.min(visible.length - 1, i);
      const v = visible[i0];
      const t = startTime + (i0 / visible.length) * dur;
      const x = pxXFromT(t);
      const y = pxY(v);
      if (c === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- Quantized samples in window + Zero-Order Hold reconstruction ---
    const maxInt = (1 << (bits - 1)) - 1;
    const iStart = Math.ceil(startTime * targetRate);
    const iEnd = Math.floor(endTimeSec * targetRate);

    // ZOH step curve
    ctx.strokeStyle = "#111827";
    ctx.beginPath();
    let havePrev = false;
    let prevY = 0;
    for (let i = iStart; i <= iEnd; i++) {
      const t = i / targetRate;
      const srcIdx = Math.min(
        samples.length - 1,
        Math.round((i * sampleRate) / targetRate)
      );
      const v = Math.max(-1, Math.min(1, samples[srcIdx]));
      const q = Math.round(v * maxInt);
      const vq = q / maxInt;

      const x = pxXFromT(t);
      const y = pxY(vq);

      if (!havePrev) {
        ctx.moveTo(x, y);
        havePrev = true;
      } else {
        // horizontal at prev level, then vertical to new level
        ctx.lineTo(x, prevY);
        ctx.lineTo(x, y);
      }
      prevY = y;
    }
    ctx.stroke();

    // Sample stems
    ctx.strokeStyle = "#2563eb";
    for (let i = iStart; i <= iEnd; i++) {
      const t = i / targetRate;
      const srcIdx = Math.min(
        samples.length - 1,
        Math.round((i * sampleRate) / targetRate)
      );
      const v = Math.max(-1, Math.min(1, samples[srcIdx]));
      const q = Math.round(v * maxInt);
      const vq = q / maxInt;
      const x = pxXFromT(t);
      const y = pxY(vq);
      ctx.beginPath();
      ctx.moveTo(x, pxY(0));
      ctx.lineTo(x, y);
      ctx.stroke();
    }
     // eslint-disable-next-line
  }, [samples, sampleRate, targetRate, bits, showZero, winMs, startSample]);

  // Keep pan in range when zoom changes
  useEffect(() => {
    setStartSample((s) =>
      Math.max(0, Math.min(s, Math.max(0, samples.length - windowSamples)))
    );
  }, [windowSamples, samples.length]);

  const kbps = React.useMemo(
    () => (targetRate * bits) / 1000,
    [targetRate, bits]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
        <label className="flex items-center gap-2">
          <span>Sample rate:</span>
          <input
            type="range"
            min={2000}
            max={48000}
            step={1000}
            value={targetRate}
            onChange={(e) => setTargetRate(parseInt(e.target.value))}
          />
          <span className="tabular-nums w-16 text-right">{targetRate} Hz</span>
        </label>
        <label className="flex items-center gap-2">
          <span>Quantization:</span>
          <input
            type="range"
            min={4}
            max={16}
            step={1}
            value={bits}
            onChange={(e) => setBits(parseInt(e.target.value))}
          />
          <span className="tabular-nums w-8 text-right">{bits}b</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showZero}
            onChange={(e) => setShowZero(e.target.checked)}
          />
          <span>Zero line</span>
        </label>
        <label className="flex items-center gap-2">
          <span>Zoom (window):</span>
          <input
            type="range"
            min={10}
            max={fullMs}
            step={10}
            value={winMs}
            onChange={(e) => setWinMs(parseInt(e.target.value))}
          />
          <span className="tabular-nums w-20 text-right">{winMs} ms</span>
        </label>
        <label className="flex items-center gap-2">
          <span>Pan:</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, samples.length - windowSamples)}
            step={Math.max(1, Math.floor(windowSamples / 100))}
            value={clampedStart}
            onChange={(e) => setStartSample(parseInt(e.target.value))}
          />
        </label>
        <span className="ml-auto text-gray-500">~{kbps.toFixed(1)} kbps</span>
      </div>

      <canvas ref={canvasRef} className="w-full h-[320px]" />
    </div>
  );
}

// optional named export
export { SamplingCanvas };


/***************************\n * 4) Windowed FFT View     *
 ***************************/
export function WindowFFTCanvas({
  samples,
  sampleRate,
}: {
  samples: Float32Array;
  sampleRate: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [windowSize, setWindowSize] = useState(2048); // number of samples
  const [centerIndex, setCenterIndex] = useState(0);
  const [logScale, setLogScale] = useState(true);

  const { mags } = useMemo(() => {
    if (samples.length === 0) return { mags: new Float64Array(0), binHz: 1 };
    const halfWin = Math.floor(windowSize / 2);
    const start = Math.max(0, centerIndex - halfWin);
    const end = Math.min(samples.length, centerIndex + halfWin);
    const segment = new Float64Array(windowSize);
    const segSamples = samples.subarray(start, end);
    segment.set(segSamples);
    applyHann(segment);
    const { re, im } = fftComplex(segment);
    const half = Math.floor(windowSize / 2);
    const mags = new Float64Array(half);
    for (let k = 0; k < half; k++) {
      mags[k] = Math.hypot(re[k], im[k]);
    }
    for (let k = 0; k < half; k++) mags[k] = (mags[k] * 2) / windowSize;
    const binHz = sampleRate / windowSize;
    return { mags, binHz };
  }, [samples, sampleRate, windowSize, centerIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = 300 * dpr;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(0, h - 0.5);
    ctx.lineTo(w, h - 0.5);
    ctx.stroke();

    const maxMag = mags.reduce((m, v) => (v > m ? v : m), 1e-12);

    ctx.beginPath();
    ctx.strokeStyle = "#0f172a";
    for (let k = 0; k < mags.length; k++) {
      const x = (k / mags.length) * w;
      let y;
      if (logScale) {
        const db = 20 * Math.log10(mags[k] / maxMag + 1e-12);
        const minDb = -80;
        const t = (db - minDb) / (0 - minDb);
        y = h - Math.max(0, Math.min(1, t)) * (h - 2 * dpr);
      } else {
        const t = mags[k] / maxMag;
        y = h - t * (h - 2 * dpr);
      }
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }, [mags, logScale]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
        <label className="flex items-center gap-2">
          <span>Samples</span>
          <select
            className="border rounded px-2 py-1"
            value={windowSize}
            onChange={(e) => setWindowSize(parseInt(e.target.value))}
          >
            {[512, 1024, 2048, 4096, 8192].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span>Timestamp:</span>
          <input
            type="range"
            min={0}
            max={samples.length - 1}
            step={windowSize / 4}
            value={centerIndex}
            onChange={(e) => setCenterIndex(parseInt(e.target.value))}
          />
          <span className="tabular-nums ml-1">
            {(centerIndex / sampleRate).toFixed(2)} s
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={logScale}
            onChange={(e) => setLogScale(e.target.checked)}
          />
          <span>Log (dB) scale</span>
        </label>
      </div>
      <canvas ref={canvasRef} className="w-full h-[300px]" />
    </div>
  );
}

// Remember to export this new component and add it as a tab in AudioExplorer if desired.


/***********************\n * Math / DSP Helpers   *
 ***********************/
function nextPow2(n: number) {
  return 1 << (32 - Math.clz32(Math.max(1, n - 1)));
}

function applyHann(x: Float64Array) {
  const N = x.length;
  for (let n = 0; n < N; n++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1)));
    x[n] *= w;
  }
}

/** Minimal iterative radix-2 FFT for real input (imag=0). Returns complex arrays. */
function fftComplex(realIn: Float64Array) {
  const N = nextPow2(realIn.length);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  re.set(realIn.subarray(0, Math.min(N, realIn.length)));
  // bit-reversal permutation
  for (let i = 0, j = 0; i < N; i++) {
    if (i < j) {
      const tr = re[i];
      const ti = im[i];
      re[i] = re[j];
      im[i] = im[j];
      re[j] = tr;
      im[j] = ti;
    }
    let m = N >> 1;
    while (j & m) {
      j ^= m;
      m >>= 1;
    }
    j |= m;
  }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1;
    const theta = (-2 * Math.PI) / size;
    const wpr = Math.cos(theta);
    const wpi = Math.sin(theta);
    for (let start = 0; start < N; start += size) {
      let wr = 1, wi = 0;
      for (let k = 0; k < half; k++) {
        const i0 = start + k;
        const i1 = i0 + half;
        const tr = wr * re[i1] - wi * im[i1];
        const ti = wr * im[i1] + wi * re[i1];
        re[i1] = re[i0] - tr;
        im[i1] = im[i0] - ti;
        re[i0] += tr;
        im[i0] += ti;
        // w *= wstep
        const wrNext = wr * wpr - wi * wpi;
        wi = wr * wpi + wi * wpr;
        wr = wrNext;
      }
    }
  }
  return { re, im };
}
