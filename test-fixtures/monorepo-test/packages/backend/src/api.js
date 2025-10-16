// Backend API functions
import { formatPath } from '../../shared/src/utils.js'

export function processPath(inputPath) {
  return formatPath(inputPath)
}

export function validatePath(path) {
  return path && path.length > 0
}
