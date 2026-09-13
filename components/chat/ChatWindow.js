"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import Avatar from "../common/Avatar";
import { api } from "../../services/api";

const PREDICT_DEBOUNCE_MS = 900;

function lastSeenLabel(user) {
  if (!user) return "";
  if (user.isOnline) return "Online";
  if (!user.lastSeen) return "";
  const date = new Date(user.lastSeen);
  return `Last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function ChatWindow({
  user,
  activeChat,
  messages,
  hasMore,
  loadingMore,
  onSend,
  onSendMedia,
  onLoadMore,
  onBack
}) {
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [sending, setSending] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [smartReplies, setSmartReplies] = useState([]);

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const debounceRef = useRef(null);
  const predictRequestId = useRef(0);
  const lastIncomingIdRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const prevScrollHeightRef = useRef(0);

  useEffect(() => {
    setDraft("");
    setPendingFile(null);
    setPredictions([]);
    setSmartReplies([]);
    lastIncomingIdRef.current = null;
    stickToBottomRef.current = true;
  }, [activeChat?.roomId]);

  // Auto-scroll to bottom for new messages, but preserve scroll position
  // when older messages are prepended from a "load more" (scroll-up) fetch.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (stickToBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    } else {
      container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
      stickToBottomRef.current = true;
    }
  }, [messages, activeChat?.roomId]);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container || !activeChat || !hasMore || loadingMore) return;
    if (container.scrollTop < 80) {
      stickToBottomRef.current = false;
      prevScrollHeightRef.current = container.scrollHeight;
      onLoadMore();
    }
  }

  // Smart replies: fire once per new incoming (not-mine) message.
  useEffect(() => {
    if (!activeChat || messages.length === 0) return;
    const last = messages[messages.length - 1];
    const isMine = String(last.sender?._id || last.sender) === String(user.id);
    if (isMine) return;
    if (lastIncomingIdRef.current === last._id) return;
    lastIncomingIdRef.current = last._id;

    const incomingText = last.text || (last.media ? `Shared ${last.media.originalName || "a file"}` : "");
    if (!incomingText) return;

    api
      .post("/api/ai/smart-replies", { roomId: activeChat.roomId, message: incomingText })
      .then((data) => setSmartReplies(data.enabled ? data.replies || [] : []))
      .catch(() => setSmartReplies([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeChat?.roomId]);

  function handleDraftChange(value) {
    setDraft(value);
    setSmartReplies([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!activeChat || value.trim().length < 3) {
      setPredictions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const requestId = ++predictRequestId.current;
      api
        .post("/api/ai/predict", { roomId: activeChat.roomId, draft: value })
        .then((data) => {
          if (requestId !== predictRequestId.current) return; // stale response, ignore
          setPredictions(data.enabled ? data.suggestions || [] : []);
        })
        .catch(() => {
          if (requestId === predictRequestId.current) setPredictions([]);
        });
    }, PREDICT_DEBOUNCE_MS);
  }

  function applySuggestion(text) {
    setDraft((prev) => (prev ? `${prev} ${text}` : text));
    setPredictions([]);
  }

  function useSmartReply(text) {
    setDraft(text);
    setSmartReplies([]);
  }

  function handleFilePick(event) {
    const file = event.target.files?.[0];
    if (file) setPendingFile(file);
    event.target.value = "";
  }

  async function handleSend(event) {
    event.preventDefault();
    if (sending) return;
    if (!draft.trim() && !pendingFile) return;
    setSending(true);
    try {
      if (pendingFile) {
        await onSendMedia(pendingFile, draft.trim());
      } else {
        await onSend(draft.trim());
      }
      setDraft("");
      setPendingFile(null);
      setPredictions([]);
    } finally {
      setSending(false);
    }
  }

  if (!activeChat) {
    return (
      <main className="chat-main">
        <div className="chat-empty-state">
          <div className="headline">Pick a conversation</div>
          <div>Search someone by email or open a group to start chatting.</div>
        </div>
      </main>
    );
  }

  const title = activeChat.chatType === "personal" ? activeChat.otherUser.name : activeChat.group.name;
  const subtitle = activeChat.chatType === "personal"
    ? (lastSeenLabel(activeChat.otherUser) || activeChat.otherUser.email)
    : `${activeChat.group.members.length} members`;
  const photo = activeChat.chatType === "personal" ? activeChat.otherUser.profilePhoto : activeChat.group.image;
  const online = activeChat.chatType === "personal" && activeChat.otherUser.isOnline;

  return (
    <main className="chat-main">
      <div className="chat-header">
        <button className="back-to-list" onClick={onBack} aria-label="Back to list">&larr;</button>
        <Avatar name={title} photo={photo} online={online} />
        <div>
          <div className="title">{title}</div>
          <div className="subtitle">{subtitle}</div>
        </div>
      </div>

      <div className="messages-scroll" ref={scrollRef} onScroll={handleScroll}>
        {loadingMore && <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)" }}>Loading older messages...</div>}
        {messages.length === 0 && (
          <div className="chat-empty-state">No messages yet. Say hello.</div>
        )}
        {messages.map((message, index) => {
          const senderId = String(message.sender?._id || message.sender);
          const previous = messages[index - 1];
          const previousSenderId = previous ? String(previous.sender?._id || previous.sender) : null;
          const isGrouped = Boolean(
            previous &&
            previousSenderId === senderId &&
            new Date(message.createdAt) - new Date(previous.createdAt) < 5 * 60 * 1000
          );
          return (
            <MessageBubble
              key={message._id}
              message={message}
              isMine={senderId === String(user.id)}
              showSenderName={activeChat.chatType === "group"}
              grouped={isGrouped}
            />
          );
        })}
      </div>

      {smartReplies.length > 0 && (
        <div className="ai-chip-row">
          {smartReplies.map((reply, index) => (
            <button key={index} className="ai-chip" onClick={() => useSmartReply(reply)}>
              {reply}
            </button>
          ))}
        </div>
      )}
      {predictions.length > 0 && (
        <div className="ai-chip-row">
          {predictions.map((suggestion, index) => (
            <button key={index} className="ai-chip" onClick={() => applySuggestion(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {pendingFile && (
        <div className="ai-chip-row">
          <span className="chip">
            {pendingFile.name}
            <button type="button" onClick={() => setPendingFile(null)}>&times;</button>
          </span>
        </div>
      )}

      <form className="message-input-row" onSubmit={handleSend}>
        <input ref={fileInputRef} type="file" hidden onChange={handleFilePick} />
        <button
          type="button"
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
        >
          &#128206;
        </button>
        <textarea
          rows={1}
          placeholder={pendingFile ? "Add a caption (optional)" : "Type a message"}
          value={draft}
          onChange={(event) => handleDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend(event);
            }
          }}
        />
        <button type="submit" className="send-btn" disabled={sending || (!draft.trim() && !pendingFile)}>
          &#10148;
        </button>
      </form>
    </main>
  );
}
