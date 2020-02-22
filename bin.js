#!/usr/bin/env node

const path = require('path')
const commander = require('commander')
const shell = require('shelljs')

const cwd = process.cwd()
const dirname = path.basename(cwd)
const exe = path.join(__dirname, 'exe.js')

const pkg = require('./package.json')

commander
  .name(pkg.name)
  .version(pkg.version)
  // https://github.com/tj/commander.js/pull/1102
  .storeOptionsAsProperties(false)
  .passCommandToAction(false)

commander
  .command('start')
  .option('--name [name]')
  .option('--script [script]', 'the js file to run which contains Proxier.')
  .option('--host [host]', 'which host to serve up a proxy server, default is 127.0.0.1')
  .option('--port [port]', 'which port to serve up for your proxy server')
  .option('--target [target]', 'proxy target, i.e. http://my-proxy.web.com:1080')
  .option('--token [token]', 'use should bring the token when visit your proxy server')
  .option('--debug [debug]')
  .action((options) => {
    const {
      name = dirname,
      host = '127.0.0.1',
      port,
      target,
      token,
      script,
      debug,
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

    const file = script ? path.resolve(cwd, script) : exe

    let sh = `npx pm2 start "${file}" --name ${name} --watch`
    if (debug) {
      sh += ' --no-daemon'
    }
    sh += ` -- --host=${host} --port=${port} --target=${target} --token=${token}`

    console.log(sh)

    if (debug) {
      shell.exec(`npx pm2 stop ${name}`)
    }
    shell.exec(sh)
  })

commander
  .command('stop')
  .option('--name [name]')
  .action((options) => {
    const { name = dirname } = options
    shell.exec(`npx pm2 delete ${name}`)
  })

commander.parse(process.argv)
