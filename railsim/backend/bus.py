"""In-process event bus — Kafka/Rabbit analog for the MVP."""
from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict, deque
from typing import Any

log = logging.getLogger("railsim.bus")


class EventBus:
    def __init__(self, history: int = 200) -> None:
        self._subs: dict[str, list[asyncio.Queue]] = defaultdict(list)
        self._buffer: dict[str, deque] = defaultdict(lambda: deque(maxlen=history))
        self.published = 0
        self.dropped = 0

    def topics(self) -> list[str]:
        return sorted(self._subs.keys() | self._buffer.keys())

    def depth(self) -> int:
        return sum(q.qsize() for qs in self._subs.values() for q in qs)

    def subscribers(self) -> int:
        return sum(len(v) for v in self._subs.values())

    def subscribe(self, topic: str, maxsize: int = 64) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=maxsize)
        self._subs[topic].append(q)
        return q

    def unsubscribe(self, topic: str, q: asyncio.Queue) -> None:
        if q in self._subs.get(topic, []):
            self._subs[topic].remove(q)

    async def publish(self, topic: str, payload: Any) -> None:
        envelope = {"topic": topic, "ts": time.time(), "payload": payload}
        self._buffer[topic].append(envelope)
        self.published += 1
        dead: list[asyncio.Queue] = []
        for q in list(self._subs.get(topic, [])):
            try:
                q.put_nowait(envelope)
            except asyncio.QueueFull:
                try:
                    _ = q.get_nowait()
                    q.put_nowait(envelope)
                    self.dropped += 1
                except Exception:
                    dead.append(q)
        for q in dead:
            self.unsubscribe(topic, q)

    def recent(self, topic: str, n: int = 20) -> list[dict]:
        return list(self._buffer[topic])[-n:]


bus = EventBus()
