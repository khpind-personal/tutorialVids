import type { SceneJson } from "../script/types.js";
import type { AuthCredentials } from "./auth.js";

export interface InlineLoginInput {
  credentials: AuthCredentials;
  baseUrl: string;
  username: string;
  password: string;
  tone: SceneJson["tone"];
}

export function buildInlineLoginScene(input: InlineLoginInput): SceneJson {
  const c = input.credentials;
  return {
    segment_id: "s00_login",
    page_id: "login",
    depth: "low",
    tone: input.tone,
    target_duration_s: 25,
    actions: [
      { t_ms: 0, type: "nav", url: c.login_url },
      { t_ms: 1000, type: "wait", selector: c.username_selector },
      { t_ms: 1500, type: "type", selector: c.username_selector, text: input.username,
        zoom: { scale: 1.4, in_ms: 200, hold_ms: 1500, out_ms: 200 } },
      { t_ms: 4000, type: "type", selector: c.password_selector, text: "•".repeat(input.password.length),
        zoom: { scale: 1.4, in_ms: 200, hold_ms: 1500, out_ms: 200 } },
      { t_ms: 7000, type: "click", selector: c.submit_selector,
        zoom: { scale: 2.0, in_ms: 300, hold_ms: 800, out_ms: 300 }, ripple: true,
        callout: { text: "Sign in to access your dashboard", anchor: "right", duration_ms: 2000 } }
    ],
    narration: {
      text: "First, let's sign in. Enter your username, then your password, and click sign in.",
      ssml: "<speak>First, let's sign in. <break time='200ms'/>Enter your username, then your password, and click sign in.</speak>",
      alignments: [
        { phrase: "sign in", action_t_ms: 0 },
        { phrase: "username", action_t_ms: 1500 },
        { phrase: "password", action_t_ms: 4000 },
        { phrase: "click sign in", action_t_ms: 7000 }
      ]
    }
  };
}
