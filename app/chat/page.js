"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProtectedRoute from "../../components/common/ProtectedRoute";
import Sidebar from "../../components/chat/Sidebar";
import ChatWindow from "../../components/chat/ChatWindow";
import TrialBanner from "../../components/chat/TrialBanner";
import CreateGroupModal from "../../components/groups/CreateGroupModal";
import GroupSettingsModal from "../../components/groups/GroupSettingsModal";
import { useAuth } from "../../hooks/useAuth";
import { useToast } from "../../hooks/useToast";
import { api, uploadWithProgress } from "../../services/api";
import { getSocket, connectSocket } from "../../services/socket";
import { createGroup as createGroupRequest } from "../../services/groups";
import { getAdminContact } from "../../services/admin";
import { createPersonalRoomId, normalizeEmail } from "../../utils/room";

function mergePresenceIntoUser(target, presence) {
  if (!target) return target;
  if (String(target.id) !== String(presence.userId)) return target;
  return { ...target, isOnline: presence.isOnline, lastSeen: presence.lastSeen };
}

function mergePresenceIntoMembers(members, presence) {
  if (!members) return members;
  return members.map((member) =>
    String(member._id) === String(presence.userId)
      ? { ...member, isOnline: presence.isOnline, lastSeen: presence.lastSeen }
      : member
  );
}

function ChatContent() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [personalChats, setPersonalChats] = useState([]);
  const [groups, setGroups] = useState([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [adminContact, setAdminContact] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [settingsGroup, setSettingsGroup] = useState(null);
  const [mobileSidebarHidden, setMobileSidebarHidden] = useState(false);

  const activeChatRef = useRef(null);
  activeChatRef.current = activeChat;

  const canUseGroups = user.role === "admin" || user.approvalStatus === "approved";

  // The admin's chat is always pinned at the top so a brand-new user (who
  // has no message history and doesn't know the admin's email) can still
  // reach them for approval without searching. If there's already a real
  // conversation with the admin, that entry is promoted to the top and
  // marked pinned rather than duplicated.
  const displayPersonalChats = useMemo(() => {
    if (!adminContact || user.role === "admin") return personalChats;
    const existing = personalChats.find((chat) => String(chat.user.id) === String(adminContact.id));
    const others = personalChats.filter((chat) => String(chat.user.id) !== String(adminContact.id));
    const pinnedEntry = existing
      ? { ...existing, pinned: true, user: { ...existing.user, ...adminContact } }
      : {
          roomId: createPersonalRoomId(user.email, adminContact.email),
          lastMessageAt: null,
          unreadCount: 0,
          pinned: true,
          user: adminContact
        };
    return [pinnedEntry, ...others];
  }, [personalChats, adminContact, user.role, user.email]);

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
    } finally {
      setSidebarLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user.role === "admin") return;
    getAdminContact()
      .then(setAdminContact)
      .catch(() => setAdminContact(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]);

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
      setAdminContact((current) => mergePresenceIntoUser(current, presence));
      setActiveChat((current) => {
        if (current?.chatType === "personal" && String(current.otherUser.id) === String(presence.userId)) {
          return { ...current, otherUser: mergePresenceIntoUser(current.otherUser, presence) };
        }
        if (current?.chatType === "group") {
          return { ...current, group: { ...current.group, members: mergePresenceIntoMembers(current.group.members, presence) } };
        }
        return current;
      });
      setGroups((prev) =>
        prev.map((group) => ({ ...group, members: mergePresenceIntoMembers(group.members, presence) }))
      );
      setSettingsGroup((current) =>
        current ? { ...current, members: mergePresenceIntoMembers(current.members, presence) } : current
      );
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

    // Mobile browsers aggressively suspend background tabs - if the socket
    // drops while backgrounded, events (like the ones that update unread
    // badges) are silently missed until it reconnects. This resyncs
    // everything whenever that happens, and also restores the server-side
    // "which room is this socket currently in" state (a fresh connection
    // means the server no longer remembers it, so without this a reconnect
    // while viewing a chat would leave sending broken until you reopened it).
    function handleReconnect() {
      loadSidebarData();
      const current = activeChatRef.current;
      if (!current) return;
      if (current.chatType === "personal") {
        socket.emit("join_room", {
          roomId: current.roomId,
          chatType: "personal",
          otherEmail: normalizeEmail(current.otherUser.email)
        });
      } else {
        socket.emit("join_room", {
          roomId: current.roomId,
          chatType: "group",
          groupId: current.group._id
        });
      }
    }

    socket.on("new_message", handleNewMessage);
    socket.on("message_status_update", handleStatusUpdate);
    socket.on("messages_read", handleMessagesRead);
    socket.on("user_presence", handlePresence);
    socket.on("group_updated", handleGroupUpdated);
    socket.on("connect", handleReconnect);

    // Extra safety net: some mobile browsers suspend timers/sockets without
    // ever firing a "disconnect" event the socket client would notice - the
    // tab just silently goes quiet. Explicitly re-checking on visibility
    // regain catches that case too.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        connectSocket();
        loadSidebarData();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("message_status_update", handleStatusUpdate);
      socket.off("messages_read", handleMessagesRead);
      socket.off("user_presence", handlePresence);
      socket.off("group_updated", handleGroupUpdated);
      socket.off("connect", handleReconnect);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSidebarData, user.id]);

  async function openPersonalChat(otherUser) {
    const roomId = createPersonalRoomId(user.email, otherUser.email);
    const socket = getSocket();
    setMessagesLoading(true);
    setMessages([]);
    socket.emit(
      "join_room",
      { roomId, chatType: "personal", otherEmail: normalizeEmail(otherUser.email) },
      (result) => {
        setMessagesLoading(false);
        if (!result.success) {
          showToast(result.message, "error");
          return;
        }
        setActiveChat({ chatType: "personal", roomId: result.roomId, otherUser });
        setMessages(result.messages || []);
        setNextCursor(result.nextCursor || null);
        setHasMore(Boolean(result.hasMore));
        setMobileSidebarHidden(true);
        // The server already marked this room read as part of join_room -
        // mirror that locally so the badge clears immediately.
        setPersonalChats((prev) =>
          prev.map((chat) => (chat.roomId === result.roomId ? { ...chat, unreadCount: 0 } : chat))
        );
      }
    );
  }

  async function openGroupChat(group) {
    const socket = getSocket();
    setMessagesLoading(true);
    setMessages([]);
    socket.emit(
      "join_room",
      { roomId: group.roomId, chatType: "group", groupId: group._id },
      (result) => {
        setMessagesLoading(false);
        if (!result.success) {
          showToast(result.message, "error");
          return;
        }
        setActiveChat({ chatType: "group", roomId: result.roomId, group });
        setMessages(result.messages || []);
        setNextCursor(result.nextCursor || null);
        setHasMore(Boolean(result.hasMore));
        setMobileSidebarHidden(true);
        setGroups((prev) =>
          prev.map((existing) => (existing.roomId === result.roomId ? { ...existing, unreadCount: 0 } : existing))
        );
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

  async function sendMedia(file, caption, onProgress) {
    if (!activeChat) return;
    const formData = new FormData();
    formData.append("media", file);
    formData.append("roomId", activeChat.roomId);
    formData.append("chatType", activeChat.chatType);
    if (activeChat.chatType === "group") formData.append("groupId", activeChat.group._id);
    if (caption) formData.append("caption", caption);

    let data;
    try {
      data = await uploadWithProgress("/api/media/upload", formData, onProgress);
    } catch (err) {
      showToast(err.message || "Unable to send media", "error");
      throw err;
    }
    if (!data.success) {
      showToast(data.message || "Unable to send media", "error");
      throw new Error(data.message || "Unable to send media");
    }
    setMessages((prev) => (prev.some((item) => item._id === data.message._id) ? prev : [...prev, data.message]));
  }

  async function searchByEmail(email) {
    const data = await api.get(`/api/users/exists?email=${encodeURIComponent(email)}`);
    return data.user;
  }

  async function createGroup({ name, description, memberEmails }) {
    const group = await createGroupRequest({ name, description, memberEmails });
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
        personalChats={displayPersonalChats}
        groups={groups}
        loading={sidebarLoading}
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
          messagesLoading={messagesLoading}
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
