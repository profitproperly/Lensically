const TECHNICAL_ERROR_PATTERN =
  /(failed to fetch|networkerror|aborterror|timeout|timed out|network request|api request failed|syntaxerror|typeerror|referenceerror|internal server error)/i;

export function toUserFacingAuthError(error: unknown, fallbackMessage: string): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timed out. Please try again.";
  }

  if (error instanceof TypeError) {
    return "Connection error. Please try again.";
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (!message || TECHNICAL_ERROR_PATTERN.test(message)) {
      return fallbackMessage;
    }
    return message;
  }

  return fallbackMessage;
}
