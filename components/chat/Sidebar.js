"use client";

import { useState } from "react";
import Link from "next/link";
import Avatar from "../common/Avatar";
import ThemeToggle from "../common/ThemeToggle";

function lastSeenLabel(user) {
  if (user.isOnline) return "Online";
  if (!user.lastSeen) return "";
  const date = new Date(user.lastSeen);
  return `Last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function Sidebar({
  user,
  personalChats,
  groups,
  activeChat,
  onOpenPersonal,
  onOpenGroup,
  onSearchEmail,
  onCreateGroupClick,
  onGroupSettingsClick,
  onLogout,
  mobileHidden,
  canUseGroups
}) {
  const [tab, setTab] = useState("chats");
  const [searchValue, setSearchValue] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  async function handleSearch(event) {
    event.preventDefault();
    setSearchError("");
    setSearchResult(null);
    const email = searchValue.trim();
    if (!email) return;
    setSearching(true);
    try {
      const foundUser = await onSearchEmail(email);
      setSearchResult(foundUser);
    } catch (err) {
      setSearchError(err.message || "User not found");
    } finally {
      setSearching(false);
    }
  }

  function selectSearchResult() {
    if (!searchResult) return;
    onOpenPersonal(searchResult);
    setSearchValue("");
    setSearchResult(null);
  }

  return (
    <aside className={`sidebar ${mobileHidden ? "hidden-mobile" : ""}`}>
      <div className="sidebar-header">
        <div className="identity">
          <Avatar name={user.name} photo={user.profilePhoto} />
          <span className="name">{user.name}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {user.role === "admin" && (
            <Link href="/admin" className="icon-btn" title="Admin dashboard">&#128274;</Link>
          )}
          <Link href="/profile" className="icon-btn" title="Profile">&#9881;</Link>
          <ThemeToggle />
          <button className="icon-btn" title="Log out" onClick={onLogout}>&#8677;</button>
        </div>
      </div>

      <form className="search-row" onSubmit={handleSearch}>
        <input
          type="email"
          placeholder="Search by email to start a chat"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
        />
        <button type="submit" className="icon-btn" disabled={searching}>&#128269;</button>
      </form>
      {searchError && (
        <div style={{ padding: "0 16px 8px", color: "#e79b8a", fontSize: "0.8rem" }}>{searchError}</div>
      )}
      {searchResult && (
        <div className="sidebar-item" onClick={selectSearchResult}>
          <Avatar name={searchResult.name} photo={searchResult.profilePhoto} online={searchResult.isOnline} />
          <div className="meta">
            <div className="title">{searchResult.name}</div>
            <div className="subtitle">{searchResult.email}</div>
          </div>
        </div>
      )}

      <div className="sidebar-tabs">
        <button className={tab === "chats" ? "active" : ""} onClick={() => setTab("chats")}>
          Chats
        </button>
        <button className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>
          Groups
        </button>
      </div>

      {tab === "chats" && (
        <div className="sidebar-list">
          {personalChats.length === 0 && (
            <div className="sidebar-empty">No conversations yet. Search an email above to start one.</div>
          )}
          {personalChats.map((chat) => (
            <div
              key={chat.roomId}
              className={`sidebar-item ${activeChat?.roomId === chat.roomId ? "active" : ""}`}
              onClick={() => onOpenPersonal(chat.user)}
            >
              <Avatar name={chat.user.name} photo={chat.user.profilePhoto} online={chat.user.isOnline} />
              <div className="meta">
                <div className="title">{chat.user.name}</div>
                <div className="subtitle">{lastSeenLabel(chat.user) || chat.user.email}</div>
              </div>
              {chat.unreadCount > 0 && (
                <span className="unread-badge">{chat.unreadCount > 99 ? "99+" : chat.unreadCount}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "groups" && (
        <div className="sidebar-list">
          <div style={{ padding: "0 16px 8px" }}>
            <button
              className="btn btn-secondary"
              style={{ width: "100%", color: "#eef0ee", borderColor: "rgba(255,255,255,0.2)" }}
              onClick={onCreateGroupClick}
              disabled={!canUseGroups}
              title={canUseGroups ? "" : "Admin approval will be required to join or create a group"}
            >
              + New group
            </button>
            {!canUseGroups && (
              <div style={{ fontSize: "0.72rem", color: "#9fada8", marginTop: 6 }}>
                Admin approval will be required to create or join a group.
              </div>
            )}
          </div>
          {groups.length === 0 && <div className="sidebar-empty">No groups yet.</div>}
          {groups.map((group) => (
            <div
              key={group._id}
              className={`sidebar-item ${activeChat?.roomId === group.roomId ? "active" : ""}`}
              onClick={() => onOpenGroup(group)}
            >
              <Avatar name={group.name} photo={group.image} />
              <div className="meta">
                <div className="title">{group.name}</div>
                <div className="subtitle">{group.members.length} members</div>
              </div>
              {group.unreadCount > 0 && (
                <span className="unread-badge">{group.unreadCount > 99 ? "99+" : group.unreadCount}</span>
              )}
              <button
                type="button"
                className="icon-btn"
                title="Group settings"
                onClick={(event) => {
                  event.stopPropagation();
                  onGroupSettingsClick(group);
                }}
              >
                &#8942;
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
