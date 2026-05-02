import { useCurrentFrame, useVideoConfig } from "remotion";
import { activeWordAt } from "../caption.js";
import type { SrtWord } from "../srt.js";

interface Props { words: SrtWord[]; }

export function CaptionBar({ words }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t_ms = (frame / fps) * 1000;
  const active = activeWordAt(words, t_ms);
  if (!active) return null;
  const idx = words.indexOf(active);
  const start = Math.max(0, idx - 3);
  const window = words.slice(start, start + 7);
  return (
    <div style={{
      position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.7)", color: "white",
      padding: "10px 18px", borderRadius: 6, fontSize: 28, fontFamily: "system-ui"
    }}>
      {window.map((w) => (
        <span key={w.start_ms} style={{ marginRight: 8, color: w === active ? "#FBBF24" : "white" }}>{w.word}</span>
      ))}
    </div>
  );
}
