const Proxier = require('./core/proxier.js')
const args = require('process.args')(1)
const Cookie = require('cookie')

const { host, port, target, token, headers = '' } = args

const tokenKey = 'EGW-Token-' + port
const tokenValue = token

const proxier = new Proxier({
  host,
  port: +port,
  target,
})

if (tokenValue) {
  proxier.gateway.setRule({
    async auth(req, res) {
      const { cookies, headers, query } = req
      const { [tokenKey]: cookieToken } = cookies
      const { [tokenKey]: headerToken } = headers
      const { token: queryToken } = query

      if (queryToken) {
        if (queryToken !== tokenValue) {
          res.clearCookie(tokenKey)
          throw new Error('query?token does not match token.')
        }
      }
      else if (cookieToken) {
        if (cookieToken !== tokenValue) {
          res.clearCookie(tokenKey)
          throw new Error('cookies.token does not match token.')
        }
      }
      else if (headerToken) {
        if (cookieToken !== tokenValue) {
          throw new Error('headers.token does not match token.')
        }
      }
      else {
        throw new Error('did not recieve token.')
      }
    },
    response(res) {
      const tokenCookie = Cookie.serialize(tokenKey, tokenValue, {
        httpOnly: true,
        maxAge: 3600*12,
      })
      res.headers['set-cookie'] = res.headers['set-cookie'] || []
      res.headers['set-cookie'].push(tokenCookie)
    },
  })
}

if (headers) {
  const items = headers.split(',')
  proxier.gateway.setRule({
    request(req) {
      items.forEach((item) => {
        const [key, value] = item.split(':')
        if (key && value) {
          req.setHeader(key, value)
        }
      })
    },
  })
}

proxier.start()