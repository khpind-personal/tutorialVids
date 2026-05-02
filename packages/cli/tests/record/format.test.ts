import { describe, it, expect } from "vitest";
import { formatRecordMarkdown } from "../../src/record/format.js";
import type { RecordSegmentResult } from "../../src/record/types.js";

const segs: RecordSegmentResult[] = [
  {
    segment_id: "s01_dashboard",
    mp4_path: "/cache/record/s01_dashboard/abc.mp4",
    cursor_track_path: "/cache/record/s01_dashboard/abc.cursor.json",
    duration_ms: 30000,
  },
  {
    segment_id: "s02_profile",
    mp4_path: "/cache/record/s02_profile/def.mp4",
    cursor_track_path: "/cache/record/s02_profile/def.cursor.json",
    duration_ms: 22000,
  },
];

describe("formatRecordMarkdown", () => {
  it("lists each segment with its mp4 path + duration", () => {
    const md = formatRecordMarkdown(segs);
    expect(md).toMatch(/s01_dashboard/);
    expect(md).toMatch(/abc\.mp4/);
    expect(md).toMatch(/0:30/);
  });
});
