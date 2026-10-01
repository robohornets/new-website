import "server-only";
import MarkdownIt from "markdown-it";

// html: false escapes any raw HTML, and markdown-it's link validation drops
// javascript:/vbscript:/file: URLs, so admin-written posts can't inject script.
const md = new MarkdownIt({ html: false, linkify: true, typographer: true, breaks: false });

const defaultLinkOpen =
  md.renderer.rules.link_open ?? ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = String(tokens[idx].attrGet("href") ?? "");
  if (/^https?:\/\//i.test(href)) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

export function renderMarkdown(source: string): string {
  return md.render(source);
}
