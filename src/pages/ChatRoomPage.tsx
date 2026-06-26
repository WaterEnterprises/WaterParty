import { useParams } from "react-router-dom";
import { useStore } from "../lib/Store";
import { PartyChatPage } from "./PartyChatPage";
import { DmChatPage } from "./DmChatPage";

/**
 * ChatRoomPage detects whether the current chat is a party (group) chat
 * or a direct message (DM) and renders the appropriate page component.
 *
 * The child pages handle their own loading and error states via useChatRoom().
 */
export function ChatRoomPage() {
  const { chatId } = useParams();
  const { chats } = useStore();
  const chat = chats.find((c) => c.ID === chatId);

  // Show loading until chat is available in the store so we can route correctly
  if (!chat) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <p className="text-text-muted mb-4 font-bold uppercase tracking-widest animate-pulse">
          Establishing Session Code...
        </p>
      </div>
    );
  }

  return chat.IsGroup ? <PartyChatPage /> : <DmChatPage />;
}
