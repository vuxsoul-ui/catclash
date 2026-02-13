export type MarkdownStreamerSpacing = "preserve" | "single" | "tight";
export type MarkdownStreamer = {
    /**
     * Push an appended Markdown delta (chunk) into the streamer.
     * Returns ANSI text to write to the terminal (append-only).
     */
    push: (delta: string) => string;
    /**
     * Flush remaining buffered content and finish the stream.
     * Optionally accepts one last delta.
     */
    finish: (finalDelta?: string) => string;
    /**
     * Reset internal state (buffer, fence/table detection, spacing).
     */
    reset: () => void;
};
export type MarkdownStreamerOptions = {
    /**
     * Function used to render a Markdown fragment (block or line) to ANSI.
     * Must be pure (no cursor control) and must not rely on prior terminal state.
     */
    render: (markdown: string) => string;
    /**
     * Hybrid streaming: emit complete lines immediately, but buffer multi-line
     * constructs (fenced code blocks + tables) until they are complete.
     *
     * This is designed for terminal scrollback safety: no in-place redraw, no cursor moves.
     */
    mode?: "hybrid";
    /**
     * Controls how blank lines are emitted.
     * - preserve: emit blank lines exactly as received
     * - single: collapse consecutive blank lines to a single blank line
     * - tight: drop blank lines entirely (dense output)
     */
    spacing?: MarkdownStreamerSpacing;
};
export declare function createMarkdownStreamer(options: MarkdownStreamerOptions): MarkdownStreamer;
