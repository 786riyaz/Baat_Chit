"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ProtectedRoute from "../../components/common/ProtectedRoute";
import Sidebar from "../../components/chat/Sidebar";
import ChatWindow from "../../components/chat/ChatWindow";
import TrialBanner from "../../components/chat/TrialBanner";
import CreateGroupModal from "../../components/groups/CreateGroupModal";
import GroupSettingsModal from "../../components/groups/GroupSettingsModal";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { api, API_BASE, getToken } from "../../services/api";
import { getSocket, connectSocket } from "../../services/socket";
import { createGroup as createGroupRequest } from "../../services/groups";
import { createPersonalRoomId, normalizeEmail } from "../../utils/room";

function mergePresenceIntoUser(target, presence) {
  if (!target) return target;
  if (String(target.id) !== String(presence.userId)) return target;
  return { ...target, isOnline: presence.isOnline, lastSeen: presence.lastSeen };
}

function ChatContent() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [personalChats, setPersonalChats] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [settingsGroup, setSettingsGroup] = useState(null);
  const [mobileSidebarHidden, setMobileSidebarHidden] = useState(false);

  const activeChatRef = useRef(null);
  activeChatRef.current = activeChat;

  const canUseGroups = user.role === "admin" || user.approvalStatus === "approved";

  const loadSidebarData = useCallback(async () => {
    try {
      const [chatsData, groupsData] = await Promise.all([
        api.get("/api/personal-chats/recent"),
        api.get("/api/groups")
      ]);
      setPersonalChats(chatsData.recentChats || []);
      setGroups(groupsData.groups || []);
    } catch (err) {
      showToast(err.message || "Unable to load chats", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSidebarData();
  }, [loadSidebarData]);

  // Socket listeners live for the lifetime of the page - not scoped to
  // whichever room is currently open, since the backend now delivers events
  // for every room this user belongs to.
  useEffect(() => {
    const socket = connectSocket();

    function handleNewMessage(message) {
      const current = activeChatRef.current;
      if (current && current.roomId === message.roomId) {
        setMessages((prev) => (prev.some((item) => item._id === message._id) ? prev : [...prev, message]));
        // The room is actively open - mark it read immediately.
        if (String(message.sender?._id || message.sender) !== String(user.id)) {
          socket.emit("mark_read", { roomId: message.roomId });
        }
      }
      loadSidebarData();
    }

    function handleStatusUpdate({ messageId, status, deliveredTo, readBy }) {
      setMessages((prev) =>
        prev.map((message) =>
          String(message._id) === String(messageId)
            ? { ...message, status, deliveredTo: deliveredTo || message.deliveredTo, readBy: readBy || message.readBy }
            : message
        )
      );
    }

    function handleMessagesRead({ roomId, messageIds }) {
      const current = activeChatRef.current;
      if (!current || current.roomId !== roomId) return;
      const idSet = new Set((messageIds || []).map(String));
      setMessages((prev) =>
        prev.map((message) => (idSet.has(String(message._id)) ? { ...message, status: "read" } : message))
      );
    }

    function handlePresence(presence) {
      setPersonalChats((prev) => prev.map((chat) => ({ ...chat, user: mergePresenceIntoUser(chat.user, presence) })));
      setActiveChat((current) => {
        if (current?.chatType === "personal" && String(current.otherUser.id) === String(presence.userId)) {
          return { ...current, otherUser: mergePresenceIntoUser(current.otherUser, presence) };
        }
        return current;
      });
    }

    function handleGroupUpdated({ groupId, group }) {
      setGroups((prev) => prev.map((existing) => (String(existing._id) === String(groupId) ? group : existing)));
      setActiveChat((current) =>
        current?.chatType === "group" && String(current.group._id) === String(groupId)
          ? { ...current, group }
          : current
      );
      setSettingsGroup((current) => (current && String(current._id) === String(groupId) ? group : current));
    }

    socket.on("new_message", handleNewMessage);
    socket.on("message_status_update", handleStatusUpdate);
    socket.on("messages_read", handleMessagesRead);
    socket.on("user_presence", handlePresence);
    socket.on("group_updated", handleGroupUpdated);
    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_status_update", handleStatusUpdate);
      socket.off("messages_read", handleMessagesRead);
      socket.off("user_presence", handlePresence);
      socket.off("group_updated", handleGroupUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSidebarData, user.id]);

  async function openPersonalChat(otherUser) {
    const roomId = createPersonalRoomId(user.email, otherUser.email);
    const socket = getSocket();
    socket.emit(
      "join_room",
      { roomId, chatType: "personal", otherEmail: normalizeEmail(otherUser.email) },
      (result) => {
        if (!result.success) {
          showToast(result.message, "error");
          return;
        }
        setActiveChat({ chatType: "personal", roomId: result.roomId, otherUser });
        setMessages(result.messages || []);
        setNextCursor(result.nextCursor || null);
        setHasMore(Boolean(result.hasMore));
        setMobileSidebarHidden(true);
      }
    );
  }

  async function openGroupChat(group) {
    const socket = getSocket();
    socket.emit(
      "join_room",
      { roomId: group.roomId, chatType: "group", groupId: group._id },
      (result) => {
        if (!result.success) {
          showToast(result.message, "error");
          return;
        }
        setActiveChat({ chatType: "group", roomId: result.roomId, group });
        setMessages(result.messages || []);
        setNextCursor(result.nextCursor || null);
        setHasMore(Boolean(result.hasMore));
        setMobileSidebarHidden(true);
      }
    );
  }

  async function loadMoreMessages() {
    const current = activeChatRef.current;
    if (!current || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.get(
        `/api/messages/${encodeURIComponent(current.roomId)}?limit=50&cursor=${encodeURIComponent(nextCursor)}`
      );
      setMessages((prev) => [...(data.messages || []), ...prev]);
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      showToast(err.message || "Unable to load older messages", "error");
    } finally {
      setLoadingMore(false);
    }
  }

  function sendMessage(text) {
    return new Promise((resolve, reject) => {
      const socket = getSocket();
      socket.emit("send_message", { text }, (result) => {
        if (!result.success) {
          showToast(result.message, "error");
          reject(new Error(result.message));
          return;
        }
        setMessages((prev) => (prev.some((item) => item._id === result.message._id) ? prev : [...prev, result.message]));
        resolve(result);
      });
    });
  }

  async function sendMedia(file, caption) {
    if (!activeChat) return;
    const formData = new FormData();
    formData.append("media", file);
    formData.append("roomId", activeChat.roomId);
    formData.append("chatType", activeChat.chatType);
    if (activeChat.chatType === "group") formData.append("groupId", activeChat.group._id);
    if (caption) formData.append("caption", caption);

    const response = await fetch(`${API_BASE}/api/media/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      showToast(data.message || "Unable to send media", "error");
      throw new Error(data.message || "Unable to send media");
    }
    setMessages((prev) => (prev.some((item) => item._id === data.message._id) ? prev : [...prev, data.message]));
  }

  async function searchByEmail(email) {
    const data = await api.get(`/api/users/exists?email=${encodeURIComponent(email)}`);
    return data.user;
  }

  async function createGroup({ name, memberEmails }) {
    const group = await createGroupRequest({ name, memberEmails });
    showToast("Group created", "success");
    setShowGroupModal(false);
    await loadSidebarData();
    openGroupChat(group);
  }

  function handleGroupSettingsUpdated(updatedGroup) {
    setGroups((prev) => prev.map((existing) => (String(existing._id) === String(updatedGroup._id) ? updatedGroup : existing)));
    setActiveChat((current) =>
      current?.chatType === "group" && String(current.group._id) === String(updatedGroup._id)
        ? { ...current, group: updatedGroup }
        : current
    );
    setSettingsGroup(updatedGroup);
  }

  function handleGroupLeft() {
    const leftGroupId = settingsGroup?._id;
    setSettingsGroup(null);
    setActiveChat((current) => (current?.chatType === "group" && String(current.group._id) === String(leftGroupId) ? null : current));
    loadSidebarData();
  }

  return (
    <div className="chat-shell">
      <Sidebar
        user={user}
        personalChats={personalChats}
        groups={groups}
        activeChat={activeChat}
        onOpenPersonal={openPersonalChat}
        onOpenGroup={openGroupChat}
        onSearchEmail={searchByEmail}
        onCreateGroupClick={() => setShowGroupModal(true)}
        onGroupSettingsClick={(group) => setSettingsGroup(group)}
        onLogout={logout}
        mobileHidden={mobileSidebarHidden}
        canUseGroups={canUseGroups}
      />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 }}>
        <TrialBanner user={user} />
        <ChatWindow
          user={user}
          activeChat={activeChat}
          messages={messages}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onSend={sendMessage}
          onSendMedia={sendMedia}
          onLoadMore={loadMoreMessages}
          onBack={() => setMobileSidebarHidden(false)}
        />
      </div>
      {showGroupModal && (
        <CreateGroupModal onClose={() => setShowGroupModal(false)} onCreate={createGroup} />
      )}
      {settingsGroup && (
        <GroupSettingsModal
          group={settingsGroup}
          currentUserId={user.id}
          onClose={() => setSettingsGroup(null)}
          onUpdated={handleGroupSettingsUpdated}
          onLeft={handleGroupLeft}
        />
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatContent />
    </ProtectedRoute>
  );
}
