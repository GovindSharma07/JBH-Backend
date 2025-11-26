// Base class for custom API errors
export class ApiError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Specific error types for better handling in controllers
export class InvalidCredentialsError extends ApiError {
  constructor(message: string = "Invalid credentials") {
    super(message, 401);
  }
}

export class EmailNotVerifiedError extends ApiError {
  constructor(message: string = "Email not verified. Please check your inbox.") {
    super(message, 403); // 403 Forbidden
  }
}

export class UserNotFoundError extends ApiError {
  constructor(message: string = "User not found") {
    super(message, 404);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string = "Bad request") {
    super(message, 400);
  }
}

export class TokenExpiredError extends ApiError {
    constructor(message: string = "Token is invalid or has expired") {
      super(message, 400);
    }
  }

  // NEW: Error for unverified phone
export class PhoneNotVerifiedError extends ApiError {
  constructor(message: string = "Phone number not verified. Please verify your phone.") {
    super(message, 403); // 403 Forbidden
  }
}