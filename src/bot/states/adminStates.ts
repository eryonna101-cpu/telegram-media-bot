// Simple in-memory conversation state for admin flows (add channel, broadcast)
interface State {
  state: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

const store = new Map<number, State>();

const TTL = 5 * 60_000; // 5 minutes

export const adminStates = {
  set(userId: number, state: string, data: Record<string, unknown> = {}): void {
    store.set(userId, { state, data, updatedAt: Date.now() });
  },
  get(userId: number): State | undefined {
    const s = store.get(userId);
    if (!s) return undefined;
    if (Date.now() - s.updatedAt > TTL) {
      store.delete(userId);
      return undefined;
    }
    return s;
  },
  clear(userId: number): void {
    store.delete(userId);
  },
  isActive(userId: number): boolean {
    return !!this.get(userId);
  },
};

export const AdminState = {
  ADD_CHANNEL_WAIT_CHAT: "add_channel_wait_chat",
  BROADCAST_WAIT_TEXT: "broadcast_wait_text",
  BROADCAST_CONFIRM: "broadcast_confirm",
  SEARCH_WAIT_QUERY: "search_wait_query",
};