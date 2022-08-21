const CHARS = '0123456789abcdefghigklmnopqrstuvwxyzABCDEFGHIGKLMNOPQRSTUVWXYZ'

function createRandomStr(length = 16) {
  let text = ''
  for (let i = 0; i < length; i++) {
    text += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return text
}

function createRandomNum(min, max) {
  const diff = max - min
  const random = parseInt(Math.random() * diff, 10)
  const value = min + random
  return value
}

function tryParseJson(str) {
  try {
    return JSON.parse(str)
  }
  catch (e) {
    return str
  }
}

module.exports = {
  createRandomStr,
  createRandomNum,
  tryParseJson,
}
