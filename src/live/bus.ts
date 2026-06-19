import { EventEmitter } from "node:events";
import type { LiveEvent } from "./events";

/** Minimal per-job pub/sub used to fan runner events out to WebSocket clients. */
export interface EventBus {
  publish(jobId: string, event: LiveEvent): void;
  subscribe(jobId: string, listener: (event: LiveEvent) => void): () => void;
}

export class InMemoryEventBus implements EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0); // many concurrent live clients
  }

  publish(jobId: string, event: LiveEvent): void {
    this.emitter.emit(`job:${jobId}`, event);
  }

  subscribe(jobId: string, listener: (event: LiveEvent) => void): () => void {
    const channel = `job:${jobId}`;
    this.emitter.on(channel, listener);
    return () => this.emitter.off(channel, listener);
  }
}
