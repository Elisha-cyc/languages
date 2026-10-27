let last = null;
export function setTestResult(result) {
  last = result;
}
export function takeTestResult(id) {
  if (last && last.id === id) {
    const result = last;
    last = null;
    return result;
  }
  return null;
}
