const Proxier = require('./core/proxier.js')
const args = require('process.args')(1)
const Cookie = require('cookie')

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
      if (queryToken !== token) {
        res.clearCookie('Token')
        throw new Error('query?token does not match token.')
      }
    }
    else if (cookieToken) {
      if (cookieToken !== token) {
        res.clearCookie('Token')
        throw new Error('cookies.token does not match token.')
      }
    }
    else if (headerToken) {
      if (cookieToken !== token) {
        throw new Error('headers.token does not match token.')
      }
    }
    else {
      throw new Error('did not recieve token.')
    }
  },
  response(res) {
    const tokenCookie = Cookie.serialize('Token', token, {
      httpOnly: true,
      maxAge: 3600*12,
    })
    res.headers['set-cookie'] = res.headers['set-cookie'] || []
    res.headers['set-cookie'].push(tokenCookie)
  },
})

proxier.start()