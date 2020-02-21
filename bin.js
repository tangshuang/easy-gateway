const path = require('path')
const commander = require('commander')
const shell = require('shelljs')

const cwd = process.cwd()
const name = path.basename(cwd)
const exe = path.join(__dirname, 'exe.js')

const pkg = require('./package.json')

commander
  .name(pkg.name)
  .version(pkg.version)

commander
  .command('start')
  .option('--script [script]', 'the js file to run which contains Proxier.')
  .option('--host [host]', 'which host to serve up a proxy server, default is 127.0.0.1')
  .option('--port [port]', 'which port to serve up for your proxy server')
  .option('--target [target]', 'proxy target, i.e. http://my-proxy.web.com:1080')
  .option('--token [token]', 'use should bring the token when visit your proxy server')
  .action((options) => {
    const {
      host = '127.0.0.1',
      port,
      target,
      token,
      script,
    } = options

    if (!script) {
      const assert = (obj) => {
        const keys = Object.keys(obj)
        keys.forEach((key) => {
          const value = obj[key]
          if (value === undefined) {
            console.error(`--${key} should must be passed!`)
            process.exit(1)
          }
        })
      }
      assert({ port, target, token })
    }

    const file = script ? path.join(cwd, script) : exe
    const sh = `npx pm2 start "${file}" --name ${name} --watch -- --host=${host} --port=${port} --target=${target} --token=${token}`
    console.log(sh)
    shell.exec(sh)
  })

commander
  .command('stop')
  .action(() => {
    shell.exec(`npx pm2 delete ${name}`)
  })

commander.parse(process.argv)
