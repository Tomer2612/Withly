declare module '*.css';

// Globals ChatWidget registers on `window` while it's mounted, so components
// outside its tree can drive it without prop-drilling or event listeners.
interface Window {
  // Opens a chat window with a user (e.g. a profile's "send message" button).
  openChatWithUser?: (userId: string) => Promise<void>;
  // Opens/closes the conversations list (called by the header's MessagesBell).
  toggleChatWidget?: () => void;
  // Set when the bell is clicked before the widget has mounted or the user is
  // logged in; the widget opens as soon as it can and clears the flag.
  chatWidgetOpenIntent?: boolean;
}
