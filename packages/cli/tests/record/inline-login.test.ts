import { describe, it, expect } from "vitest";
import { buildInlineLoginScene } from "../../src/record/inline-login.js";

describe("buildInlineLoginScene", () => {
  it("emits a SceneJson with nav + wait + type x2 + click in order", () => {
    const scene = buildInlineLoginScene({
      credentials: {
        login_url: "/login", username_env: "U", password_env: "P",
        username_selector: "[name=u]", password_selector: "[name=p]",
        submit_selector: "button[type=submit]"
      },
      baseUrl: "http://localhost:5173",
      username: "demo", password: "demo",
      tone: "friendly"
    });
    expect(scene.segment_id).toBe("s00_login");
    expect(scene.actions.map(a => a.type)).toEqual(["nav", "wait", "type", "type", "click"]);
  });

  it("masks the password as bullets in the typed text", () => {
    const scene = buildInlineLoginScene({
      credentials: { login_url: "/login", username_env: "U", password_env: "P",
        username_selector: "u", password_selector: "p", submit_selector: "s" },
      baseUrl: "x", username: "u", password: "secret123", tone: "pro"
    });
    const typeActions = scene.actions.filter(a => a.type === "type");
    const passwordType = typeActions[1];
    expect(passwordType?.text).toBe("•••••••••");
  });
});
