import { describe, it, expect } from "vitest";
import { execa } from "execa";

describe("CLI entrypoint", () => {
  it("prints help when invoked with --help", async () => {
    const { stdout, exitCode } = await execa(
      "node",
      ["./bin/tutorialvid", "--help"],
      { cwd: new URL("..", import.meta.url).pathname, reject: false }
    );
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Usage:\s+tutorialvid/);
    expect(stdout).toMatch(/Commands:/);
  });
});
