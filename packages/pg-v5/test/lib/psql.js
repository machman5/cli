'use strict'

/* global describe it beforeEach afterEach context */

const sinon = require('sinon')
const expect = require('unexpected')
const unwrap = require('../unwrap')
const path = require('path')
const proxyquire = require('proxyquire')

const db = {
  user: 'jeff',
  password: 'pass',
  database: 'mydb',
  port: 5432,
  host: 'localhost',
  hostname: 'localhost'
}

const bastionDb = {
  user: 'jeff',
  password: 'pass',
  database: 'mydb',
  port: 5432,
  bastionHost: 'bastion-host',
  bastionKey: 'super-private-key',
  host: 'localhost',
  hostname: 'localhost'
}

describe('psql', () => {
  beforeEach(() => {
    sinon.stub(Math, 'random').callsFake(() => 0)
  })

  afterEach(() => {
    Math.random.restore()
  })

  describe('exec', () => {
    let sandbox
    let tunnelStub
    let bastion
    let psql

    beforeEach(() => {
      sandbox = sinon.createSandbox()
      tunnelStub = sandbox.stub().callsArg(1)
      bastion = proxyquire('../../lib/bastion', {
        'tunnel-ssh': tunnelStub
      })
      psql = proxyquire('../../lib/psql', {
        './bastion': bastion
      })
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('runs psql', () => {
      let cp = sandbox.stub(require('child_process'), 'spawn')
      let args = ['-c', 'SELECT NOW();', '--set', 'sslmode=require']
      cp.returns(
        {
          stdout: {
            on: (key, callback) => {
              if (key === 'data') {
                callback(new Error('2001-01-01T00:00:00.000UTC'))
              }
            }
          },
          on: (key, callback) => {
            if (key === 'close') {
              callback(new Error(0))
            } else if (key === 'error') {
              callback(null)
            }
          }
        }
      )
      return psql.exec(db, 'SELECT NOW();')
        .then(() => expect(cp.firstCall.args[0], 'to equal', 'psql'))
        .then(() => expect(cp.firstCall.args[1], 'to equal', args))
        .then(() => cp.restore())
    })
    it('opens an SSH tunnel and runs psql for bastion databases', () => {
      let cp = sandbox.stub(require('child_process'), 'spawn')
      let tunnelConf = {
        username: 'bastion',
        host: 'bastion-host',
        privateKey: 'super-private-key',
        dstHost: 'localhost',
        dstPort: 5432,
        localHost: '127.0.0.1',
        localPort: 49152
      }
      let args = ['-c', 'SELECT NOW();', '--set', 'sslmode=require']
      cp.returns(
        {
          stdout: {
            on: (key, callback) => {
              if (key === 'data') {
                callback(new Error('2001-01-01T00:00:00.000UTC'))
              }
            }
          },
          on: (key, callback) => {
            if (key === 'close') {
              callback(new Error(0))
            } else if (key === 'error') {
              callback(null)
            }
          }
        }
      )
      return psql.exec(bastionDb, 'SELECT NOW();', 1000)
        .then(() => expect(
          tunnelStub.withArgs(tunnelConf).calledOnce, 'to equal', true))
        .then(() => expect(cp.firstCall.args[0], 'to equal', 'psql'))
        .then(() => expect(cp.firstCall.args[1], 'to equal', args))
        .then(() => cp.restore())
    })
  })

  describe('execFile', () => {
    let sandbox
    let tunnelStub
    let bastion
    let psql

    beforeEach(() => {
      sandbox = sinon.createSandbox()
      tunnelStub = sandbox.stub().callsArg(1)
      bastion = proxyquire('../../lib/bastion', {
        'tunnel-ssh': tunnelStub
      })
      psql = proxyquire('../../lib/psql', {
        './bastion': bastion
      })
    })

    afterEach(() => {
      sandbox.restore()
    })

    it('runs psql', () => {
      let cp = sandbox.stub(require('child_process'), 'spawn')
      let opts = { encoding: 'utf8', stdio: [ 'ignore', 'pipe', 'inherit' ] }
      let args = ['-f', 'test.sql', '--set', 'sslmode=require']
      cp.returns(
        {
          stdout: {
            on: (key, callback) => {
              if (key === 'data') {
                callback(new Error('2001-01-01T00:00:00.000UTC'))
              }
            }
          },
          on: (key, callback) => {
            if (key === 'close') {
              callback(new Error(0))
            } else if (key === 'error') {
              callback(null)
            }
          }
        }
      )
      return psql.execFile(db, 'test.sql')
        .then(() => expect(cp.firstCall.args[0], 'to equal', 'psql'))
        .then(() => expect(cp.firstCall.args[1], 'to equal', args))
        .then(() => expect(cp.firstCall.args[2].encoding, 'to equal', opts.encoding))
        .then(() => expect(cp.firstCall.args[2].stdio, 'to equal', opts.stdio))
        .then(() => cp.restore())
    })
    it('opens an SSH tunnel and runs psql for bastion databases', () => {
      let cp = sandbox.stub(require('child_process'), 'spawn')
      let tunnelConf = {
        username: 'bastion',
        host: 'bastion-host',
        privateKey: 'super-private-key',
        dstHost: 'localhost',
        dstPort: 5432,
        localHost: '127.0.0.1',
        localPort: 49152
      }
      const args = ['-f', 'test.sql', '--set', 'sslmode=require']
      cp.returns(
        {
          stdout: {
            on: (key, callback) => {
              if (key === 'data') {
                callback(new Error('2001-01-01T00:00:00.000UTC'))
              }
            }
          },
          on: (key, callback) => {
            if (key === 'close') {
              callback(new Error(0))
            } else if (key === 'error') {
              callback(null)
            }
          }
        }
      )
      return psql.execFile(bastionDb, 'test.sql', 1000)
        .then(() => expect(
          tunnelStub.withArgs(tunnelConf).calledOnce, 'to equal', true))
        .then(() => expect(cp.firstCall.args[0], 'to equal', 'psql'))
        .then(() => expect(cp.firstCall.args[1], 'to equal', args))
        .then(() => cp.restore())
    })
  })

  describe('psqlInteractive', () => {
    const psql = proxyquire('../../lib/psql', {})
    const db = {
      attachment: {
        app: {
          name: 'sleepy-hollow-9876'
        },
        name: 'DATABASE'
      }
    }

    context('when HEROKU_PSQL_HISTORY is set', () => {
      beforeEach(() => {
        process.env.HEROKU_PSQL_HISTORY = `${path.join('/', 'path', 'to', 'history')}`
      })
      afterEach(() => {
        delete process.env.HEROKU_PSQL_HISTORY
      })

      context('when HEROKU_PSQL_HISTORY is a valid directory path', () => {
        it('is the directory path to per-app history files', () => {
          const cp = sinon.stub(require('child_process'), 'spawn')
          const existsSyncStub = sinon.stub(require('fs'), 'existsSync').callsFake(() => true)
          const statSyncStub = sinon.stub(require('fs'), 'statSync').returns({ isDirectory: () => true })

          const args = [
            '--set',
            'PROMPT1=sleepy-hollow-9876::DATABASE%R%# ',
            '--set',
            'PROMPT2=sleepy-hollow-9876::DATABASE%R%# ',
            '--set',
            `HISTFILE=${process.env.HEROKU_PSQL_HISTORY}/sleepy-hollow-9876`,
            '--set',
            'sslmode=require'
          ]

          cp.returns(
            {
              on: (key, callback) => {
                if (key === 'close') {
                  callback(new Error(0))
                }
              }
            }
          )

          return psql.interactive(db)
            .then(() => expect(cp.firstCall.args[0], 'to equal', 'psql'))
            .then(() => expect(cp.firstCall.args[1], 'to equal', args))
            .finally(() => {
              cp.restore()
              existsSyncStub.restore()
              statSyncStub.restore()
            })
        })
      })

      context('when HEROKU_PSQL_HISTORY is a valid file path', () => {
        it('is the path to the history file', () => {
          const cp = sinon.stub(require('child_process'), 'spawn')
          const existsSyncStub = sinon.stub(require('fs'), 'existsSync').callsFake(() => true)
          const statSyncStub = sinon.stub(require('fs'), 'statSync').returns({ isDirectory: () => false })

          const args = [
            '--set',
            'PROMPT1=sleepy-hollow-9876::DATABASE%R%# ',
            '--set',
            'PROMPT2=sleepy-hollow-9876::DATABASE%R%# ',
            '--set',
            `HISTFILE=${process.env.HEROKU_PSQL_HISTORY}`,
            '--set',
            'sslmode=require'
          ]

          cp.returns(
            {
              on: (key, callback) => {
                if (key === 'close') {
                  callback(new Error(0))
                }
              }
            }
          )

          return psql.interactive(db)
            .then(() => expect(cp.firstCall.args[0], 'to equal', 'psql'))
            .then(() => expect(cp.firstCall.args[1], 'to equal', args))
            .finally(() => {
              cp.restore()
              existsSyncStub.restore()
              statSyncStub.restore()
            })
        })
      })

      context('when HEROKU_PSQL_HISTORY is an invalid path', () => {
        it('issues a warning', () => {
          const cli = require('heroku-cli-util')
          cli.mockConsole()
          const cpMock = sinon.stub(require('child_process'), 'spawn')
          const existsSyncStub = sinon.stub(require('fs'), 'existsSync').callsFake(() => false)

          const args = [
            '--set',
            'PROMPT1=sleepy-hollow-9876::DATABASE%R%# ',
            '--set',
            'PROMPT2=sleepy-hollow-9876::DATABASE%R%# ',
            '--set',
            'sslmode=require'
          ]

          cpMock.returns(
            {
              on: (key, callback) => {
                if (key === 'close') {
                  callback(new Error(0))
                }
              }
            }
          )

          return psql.interactive(db)
            .then(() => expect(cpMock.firstCall.args[1], 'to equal', args))
            .then(() => expect(unwrap(cli.stderr), 'to equal', `HEROKU_PSQL_HISTORY is set but is not a valid path (${path.join('/', 'path', 'to', 'history')})\n`))
            .finally(() => {
              cpMock.restore()
              existsSyncStub.restore()
            })
        })
      })
    })
  })
})
