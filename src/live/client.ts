import { LiveEvent } from "./events";

type Of<T extends LiveEvent["type"]> = Extract<LiveEvent, { type: T }>;

export interface LiveSyncHandlers {
  onConnected?(e: Of<"connected">): void;
  onStage?(e: Of<"stage.completed">): void;
  onEitl?(e: Of<"eitl.result">): void;
  onAssetPush?(e: Of<"asset.push">): void;
  onComplete?(e: Of<"pipeline.complete">): void;
  onError?(message: string): void;
  onClose?(): void;
}

/** Engine-side WebSocket client for the Live-Sync bridge. Validates every frame
 *  against the LiveEvent contract before dispatching to typed handlers. */
export class LiveSyncClient {
  private ws?: WebSocket;
  private readonly url: string;

  constructor(baseUrl: string, jobId: string, private readonly handlers: LiveSyncHandlers = {}) {
    this.url = `${baseUrl.replace(/\/$/, "")}/live?jobId=${encodeURIComponent(jobId)}`;
  }

  /** Resolves once the server's `connected` ack has been received. */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.addEventListener("error", () => reject(new Error("live-sync connection error")));
      ws.addEventListener("close", () => this.handlers.onClose?.());
      ws.addEventListener("message", (m: MessageEvent) => {
        const ev = this.parse(String(m.data));
        if (!ev) {
          this.handlers.onError?.("malformed live event");
          return;
        }
        if (ev.type === "connected") resolve();
        this.dispatch(ev);
      });
    });
  }

  close(): void {
    this.ws?.close();
  }

  private parse(raw: string): LiveEvent | null {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return null;
    }
    const res = LiveEvent.safeParse(json);
    return res.success ? res.data : null;
  }

  private dispatch(ev: LiveEvent): void {
    switch (ev.type) {
      case "connected":
        this.handlers.onConnected?.(ev);
        break;
      case "stage.completed":
        this.handlers.onStage?.(ev);
        break;
      case "eitl.result":
        this.handlers.onEitl?.(ev);
        break;
      case "asset.push":
        this.handlers.onAssetPush?.(ev);
        break;
      case "pipeline.complete":
        this.handlers.onComplete?.(ev);
        break;
      case "error":
        this.handlers.onError?.(ev.message);
        break;
    }
  }
}
