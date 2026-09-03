const INCORRECT_EMAIL_OR_PASSWORD = "Email or password is incorrect.";
const GENERIC_AUTH_MESSAGE = "Something went wrong. Please try again.";

const AUTH_ERROR_MESSAGES = {
  "auth/invalid-credential": INCORRECT_EMAIL_OR_PASSWORD,
  "auth/wrong-password": INCORRECT_EMAIL_OR_PASSWORD,
  "auth/user-not-found": INCORRECT_EMAIL_OR_PASSWORD,
  "auth/invalid-login-credentials": INCORRECT_EMAIL_OR_PASSWORD,
  "auth/invalid-email": "Enter a valid email address.",
  "auth/missing-email": "Enter your email address.",
  "auth/missing-password": "Enter your password.",
  "auth/user-disabled": "This account has been disabled. Contact support if you need help.",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/email-already-in-use":
    "An account with this email already exists. Sign in or reset your password.",
  "auth/weak-password": "Password is too weak. Use at least 6 characters.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/popup-closed-by-user": "Sign-in was cancelled.",
  "auth/cancelled-popup-request": "Sign-in was cancelled.",
  "auth/popup-blocked": "Pop-up was blocked. Allow pop-ups for this site and try again.",
  "auth/account-exists-with-different-credential":
    "An account already exists with this email using a different sign-in method.",
  "auth/operation-not-allowed": "This sign-in method is not available right now.",
  "auth/requires-recent-login": "Please sign in again to continue.",
  "auth/expired-action-code": "This reset link has expired. Request a new one.",
  "auth/invalid-action-code": "This reset link is invalid. Request a new one.",
};

const AUTH_CODE_IN_MESSAGE = /\((auth\/[a-z0-9-]+)\)/i;

function getAuthErrorCode(error) {
  if (typeof error?.code === "string" && error.code.startsWith("auth/")) {
    return error.code;
  }

  const message = typeof error?.message === "string" ? error.message : "";
  const match = message.match(AUTH_CODE_IN_MESSAGE);
  if (match) {
    return match[1].toLowerCase();
  }

  return null;
}

export function getAuthErrorMessage(error) {
  if (!error) {
    return "";
  }

  const code = getAuthErrorCode(error);
  if (code) {
    return AUTH_ERROR_MESSAGES[code] ?? GENERIC_AUTH_MESSAGE;
  }

  const message = typeof error.message === "string" ? error.message.trim() : "";
  if (message.startsWith("Firebase:")) {
    return GENERIC_AUTH_MESSAGE;
  }

  return message || GENERIC_AUTH_MESSAGE;
}
