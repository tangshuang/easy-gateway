const CHARS = '0123456789abcdefghigklmnopqrstuvwxyzABCDEFGHIGKLMNOPQRSTUVWXYZ'

function createRandomString(length = 16) {
  let text = ''
  for (let i = 0; i < length; i++) {
    text += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return text
}

module.exports = {
  createRandomString,
}
