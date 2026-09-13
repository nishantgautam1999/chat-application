// Wraps an async route handler so rejected promises are forwarded to Express's error handler
// instead of needing a try/catch in every controller.
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default catchAsync;
