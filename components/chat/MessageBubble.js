"use client";

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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

function StatusTicks({ status }) {
  if (!status || status === "sent") {
    return <span className="message-ticks">&#10003;</span>;
  }
  if (status === "delivered") {
    return <span className="message-ticks">&#10003;&#10003;</span>;
  }
  return <span className="message-ticks read">&#10003;&#10003;</span>;
}

export default function MessageBubble({ message, isMine, showSenderName, grouped }) {
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
          {isMine && <StatusTicks status={message.status} />}
        </div>
      </div>
    </div>
  );
}
