"use client";

import { formatTime } from "../../utils/time";

function MediaContent({ media }) {
  if (!media || !media.url) return null;
  if (media.mimeType?.startsWith("image/")) {
    return <img src={media.url} alt={media.originalName || "image"} className="media-preview" />;
  }
  if (media.mimeType?.startsWith("video/")) {
    return <video src={media.url} controls className="media-preview" />;
  }
  return (
    <a href={media.url} target="_blank" rel="noreferrer" className="media-file">
      &#128206; {media.originalName || "Download file"}
    </a>
  );
}

function StatusTicks({ status, onClick }) {
  const marks = !status || status === "sent" ? "\u2713" : "\u2713\u2713";
  const className = `message-ticks ${status === "read" ? "read" : ""}`;
  if (onClick) {
    return (
      <button type="button" className={`${className} message-ticks-btn`} onClick={onClick} title="View message info">
        {marks}
      </button>
    );
  }
  return <span className={className}>{marks}</span>;
}

export default function MessageBubble({ message, isMine, showSenderName, grouped, onShowReceipts }) {
  const canShowReceipts = isMine && showSenderName && !message.archived && Boolean(onShowReceipts);
  return (
    <div className={`message-row ${isMine ? "mine" : "theirs"} ${grouped ? "grouped" : ""}`}>
      <div className="bubble">
        {showSenderName && !isMine && !grouped && message.sender?.name && (
          <div className="sender-name">{message.sender.name}</div>
        )}
        <MediaContent media={message.media} />
        {message.text && <div>{message.text}</div>}
        <div className="timestamp">
          {formatTime(message.createdAt)}
          {isMine && (
            <StatusTicks
              status={message.status}
              onClick={canShowReceipts ? () => onShowReceipts(message) : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
