import { Injectable } from '@angular/core';

type Handler = (data: any) => void;

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private sources = new Map<string, EventSource>();
  private handlers = new Map<string, Handler>();

  // url SSE: ajusta a tu backend (p.ej. /realtime/sse?channel=...)
  subscribe(channel: string, cb: Handler) {
    this.handlers.set(channel, cb);
    if (this.sources.has(channel)) return;

    const url = `/api/realtime/sse?channel=${encodeURIComponent(channel)}`; // PROXY o cambia base
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try { cb(JSON.parse(e.data)); } catch { /* noop */ }
    };
    es.onerror = () => { /* reconectar simple */ };
    this.sources.set(channel, es);
  }

  unsubscribe(channel: string) {
    const es = this.sources.get(channel);
    try { es?.close(); } catch {}
    this.sources.delete(channel);
    this.handlers.delete(channel);
  }
}
