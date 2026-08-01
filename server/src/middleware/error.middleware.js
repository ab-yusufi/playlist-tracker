export function notFoundHandler(request, response) {
  return response.status(404).json({
    success: false,

    message: `Route not found: ` + `${request.method} ${request.originalUrl}`,
  });
}

export function errorHandler(error, _request, response, _next) {
  console.error(error);

  if (response.headersSent) {
    return;
  }

  const statusCode =
    Number.isInteger(error.statusCode) && error.statusCode >= 400
      ? error.statusCode
      : 500;

  const isProduction = process.env.NODE_ENV === "production";

  const responseBody = {
    success: false,

    message:
      statusCode === 500
        ? "An unexpected server error occurred"
        : error.message,
  };

  if (error.code) {
    responseBody.code = error.code;
  }

  if (!isProduction) {
    responseBody.error = error.message;
    responseBody.stack = error.stack;
  }

  return response.status(statusCode).json(responseBody);
}
