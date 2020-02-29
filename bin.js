#!/usr/bin/env node

const path = require('path')
const { Command } = require('commander')
const shell = require('shelljs')
const fs = require('fs')
const dotenv = require('dotenv')
const { createRandomStr, createRandomNum } = require('./core/utils.js')

const cwd = process.cwd()
const dirname = path.basename(cwd)
const exe = path.join(__dirname, 'exe.js')

const pkg = require('./package.json')

const program = new Command()

program
  // https://github.com/tj/commander.js/pull/1102
   .storeOptionsAsProperties(false)
   .passCommandToAction(false)

program
  .name(pkg.name)
  .version(pkg.version)

program
  .command('start')
  .option('--name [name]')
  .option('--script [script]', 'the js file to run which modify GateWay.')
  .option('--host [host]', 'which host to serve up a proxy server, default is 127.0.0.1')
  .option('--port [port]', 'which port to serve up for your proxy server')
  .option('--target [target]', 'proxy target, i.e. http://my-proxy.web.com:1080')
  .option('--base [base]', 'the static files to serve up')
  .option('--token [token]', 'use should bring the token when visit your proxy server')
  .option('--cookies [cookies]', 'cookies which will be appended with original cookies')
  .option('--headers [headers]', 'headers to be send by proxier to target, i.e. --headers=Token:xxx,Auth:xxx')
  .option('--debug [debug]')
  .action((options) => {
    const params = {}

    // load .egwrc file content firstly
    const configfile = path.join(cwd, '.egwrc')
    if (fs.existsSync(configfile)) {
      const config = dotenv.parse(fs.readFileSync(configfile))
      Object.assign(params, config)
    }
    // use options to override
    Object.assign(params, options)

    const {
      name = dirname,
      host = '0.0.0.0',
      token = '',
      headers = '',
      cookies = '',
      port = createRandomNum(10000, 20000), // default random port
      target,
      base,
      script,
      debug,
    } = params

    if (!target && !base) {
      console.error('--target and --base are not passed!')
      process.exit(1)
    }

    let sh = `npx pm2 start "${exe}" --name="${name}"`
    if (debug) {
      sh += ' --no-daemon'
    }

    sh += ' --'
    sh += ` --host="${host}" --port="${port}"`

    if (target) {
      sh += ` --target="${target}"`
    }

    if (base) {
      sh += ` --base="${base}"`
    }

    if (token) {
      if (token === true) {
        // create a random token
        const randomStr = createRandomStr()
        sh += ` --token="${randomStr}"`
      }
      else {
        sh += ` --token="${token}"`
      }
    }

    if (headers) {
      sh += ` --headers="${headers}"`
    }
    if (cookies) {
      sh += ` --cookies="${cookies}"`
    }

    if (script) {
      const file = path.resolve(cwd, script)
      sh += ` --script="${file}"`
    }

    if (debug) {
      sh += ` --debug`
    }

    console.log(sh)

    if (debug) {
      shell.exec(`npx pm2 stop ${name}`)
    }
    shell.exec(sh)
  })

program
  .command('stop')
  .option('--name [name]')
  .action((options) => {
    const params = {}

    // load .egwrc file content firstly
    const configfile = path.join(cwd, '.egwrc')
    if (fs.existsSync(configfile)) {
      const config = dotenv.parse(fs.readFileSync(configfile))
      Object.assign(params, config)
    }
    // use options to override
    Object.assign(params, options)

    const { name = dirname } = params
    shell.exec(`npx pm2 delete ${name}`)
  })

program
  .parse(process.argv)
