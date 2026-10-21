export class ApiError extends Error {
  constructor(status, message, code = 'REQUEST_ERROR') {
    super(message); this.status = status; this.code = code;
  }
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.code === 'ER_DUP_ENTRY') error = new ApiError(409, 'El registro ya existe.', 'DUPLICATE');
  if (error.code === 'ER_NO_REFERENCED_ROW_2') error = new ApiError(422, 'La referencia indicada no existe.', 'INVALID_REFERENCE');
  if (error.type === 'entity.too.large') error = new ApiError(413, 'La solicitud supera el tamaño permitido.');
  if (error.type === 'entity.parse.failed') error = new ApiError(400, 'JSON inválido.');
  if (!(error instanceof ApiError)) console.error({ requestId: req.id, code: error.code ?? 'INTERNAL_ERROR' });
  res.status(error instanceof ApiError ? error.status : 500).json({
    error: { code: error instanceof ApiError ? error.code : 'INTERNAL_ERROR',
      message: error instanceof ApiError ? error.message : 'No se pudo completar la operación.', requestId: req.id },
  });
}
