const Proxier = require('./core/proxier.js')
const args = require('process.args')(1)

const { host, port, target, token } = args

const proxier = new Proxier({
  host,
  port: +port,
  target,
})

proxier.gateway.setRule({
  async auth(req, res) {
    const { cookies, headers, query } = req
    const { Token: cookieToken } = cookies
    const { Token: headerToken } = headers
    const { token: queryToken } = query

    if (queryToken) {
      if (queryToken === token) {
        res.cookie('Token', token, {
          httpOnly: true,
          maxAge: 3600*12,
        })
        return true
      }
      else {
        return false
      }
    }
    else if (cookieToken) {
      if (cookieToken === token) {
        return true
      }
      else {
        res.clearCookie('Token')
        return false
      }
    }
    else if (headerToken) {
      if (cookieToken === token) {
        return true
      }
      else {
        return false
      }
    }
    else {
      return false
    }
  },
})

proxier.start()