export class BotError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string,
    public readonly code: string = "error",
  ) {
    super(message);
    this.name = "BotError";
  }
}

export class DownloadError extends Error {
  constructor(
    message: string,
    public readonly code: string = "download_error",
  ) {
    super(message);
    this.name = "DownloadError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message = "unauthorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}