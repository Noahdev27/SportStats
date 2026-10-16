export interface ErrorDetail {
  path: string;
  message: string;
}

/**
 * Operational error carrying an HTTP status and a stable machine-readable code.
 * Anything thrown that is not an AppError is treated as an unexpected 500.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: ErrorDetail[]) {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details: ErrorDetail[], message = 'Les données envoyées sont invalides.') {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }

  static notFound(resource: string, id?: number | string) {
    const suffix = id === undefined ? '' : ` (id: ${id})`;
    return new AppError(404, 'NOT_FOUND', `${resource} introuvable${suffix}.`);
  }

  static conflict(message: string, code = 'CONFLICT') {
    return new AppError(409, code, message);
  }
}
