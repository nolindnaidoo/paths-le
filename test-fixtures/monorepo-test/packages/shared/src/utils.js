// Shared utility functions
export function formatPath(path) {
  return path.replace(/\\/g, '/')
}

export function isAbsolute(path) {
  return path.startsWith('/') || /^[A-Za-z]:/.test(path)
}
