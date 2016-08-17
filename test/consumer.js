/* eslint-env mocha */
'use strict'

require('dotenv').config({ silent: true })
const _ = require('lodash')
const AWS = require('aws-sdk')
const Code = require('code')
const expect = Code.expect

const Consumer = require('../lib/consumer')

const SQS = new AWS.SQS({
  region: process.env.AWS_SQS_REGION,
  accessKeyId: process.env.AWS_SQS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SQS_SECRET_ACCESS_KEY
})

const MESSAGE = {
  MessageBody: 'test',
  QueueUrl: process.env.TEST_QUEUE_URL
}

const DEFAULT_OPTS = {
  sqs: SQS,
  batchSize: 1,
  messageReceiver: null,
  queueUrl: process.env.TEST_QUEUE_URL
}

describe('SQS Consumer', () => {
  before(() => {
    if (!process.env.TEST_QUEUE_URL ||
        !process.env.AWS_SQS_REGION ||
        !process.env.AWS_SQS_ACCESS_KEY ||
        !process.env.AWS_SQS_SECRET_ACCESS_KEY) {
      Code.fail('Missing required ENV variables')
    }
  })

  // -== CONSTRUCTOR OPTIONS START ==- //
  describe('Constructor', () => {
    it('- missing options', () => {
      try {
        new Consumer()
      } catch (e) {
        expect(e).to.be.an.error(Error, 'Missing required options')
      }
    })

    it('- missing [queueUrl]', () => {
      try {
        new Consumer({})
      } catch (e) {
        expect(e).to.be.an.error(Error, /queueUrl/)
      }
    })

    it('- missing [messageReceiver]', () => {
      try {
        new Consumer({ queueUrl: process.env.TEST_QUEUE_URL })
      } catch (e) {
        expect(e).to.be.an.error(Error, /messageReceiver/)
      }
    })
  })
  // -== CONSTRUCTOR OPTIONS END ==- //

  // -== SINGLE MESSAGE W/O BUFFER START ==- //
  describe('Receive Single Messages W/O Buffer', () => {
    let messageId

    before(function (done) {
      this.timeout(5000)
      SQS.sendMessage(MESSAGE, (err, data) => {
        messageId = data.MessageId
        if (err) return done(err)
        done()
      })
    })

    it('- receive and process w/ ERROR', function (done) {
      this.timeout(10000)

      const opts = _.clone(DEFAULT_OPTS)
      opts.messageReceiver = (message, acknowledge) => acknowledge(new Error('Test Processing Error'))

      const sqs = new Consumer(opts)
      sqs.on('error', done)
      sqs.on('processing:error', err => {
        expect(err).to.exist()
        done()
      })
      sqs.on('message:processed', message => done())
      sqs.start()
    })

    it('- receive and process OK', function (done) {
      this.timeout(10000)

      const opts = _.clone(DEFAULT_OPTS)
      opts.messageReceiver = (message, acknowledge) => acknowledge(message)

      const sqs = new Consumer(opts)
      sqs.once('error', done)
      sqs.once('processing:error', done)
      sqs.once('message:processed', message => done())
      sqs.start()
    })
  })
  // -== SINGLE MESSAGE W/O BUFFER END ==- //

  // -== SINGLE MESSAGE W/ BUFFER START ==- //
  describe('Receive Single Messages W/ Buffer', () => {
    before(function (done) {
      this.timeout(5000)

      let i = 0
      while (i < 10) {
        SQS.sendMessage(MESSAGE, (err) => {
          if (err) return done(err)
        })
        if (i++ === 9) done()
      }
    })

    it('- receive and process', function (done) {
      this.timeout(10000)

      const opts = _.clone(DEFAULT_OPTS)
      opts.batchSize = 10
      opts.bufferSize = 20
      opts.bufferTimeout = 1000
      opts.messageReceiver = (message, acknowledge) => acknowledge(message)

      const sqs = new Consumer(opts)
      sqs.once('error', done)
      sqs.once('processing:error', done)
      sqs.once('message:processed', message => done())
      sqs.start()
    })
  })
  // -== SINGLE MESSAGE W/ BUFFER END ==- //

  // -== BATCH MESSAGE START ==- //
  describe('Receive Batch Messages W/O Buffer', () => {
    before(function (done) {
      this.timeout(5000)
      let ID = 0

      const entries = []
      for (let i of new Array(10)) {
        let id = ++ID

        entries.push({
          Id: id.toString(),
          MessageBody: 'batch test'
        })
      }

      const params = {
        Entries: entries,
        QueueUrl: MESSAGE.QueueUrl
      }

      SQS.sendMessageBatch(params, err => {
        if (err) return done(err)
        done()
      })
    })

    it('- w/o buffer', function (done) {
      this.timeout(10000)

      const opts = _.clone(DEFAULT_OPTS)
      opts.batchSize = 10
      opts.messageReceiver = (message, acknowledge) => acknowledge(message)

      const sqs = new Consumer(opts)
      sqs.once('error', done)
      sqs.once('message:received', messages => {
        expect(messages).to.exist()
      })
      sqs.once('processing:error', done)
      sqs.once('message:processed', message => done())
      sqs.start()
    })
  })
  // -== BATCH MESSAGE END ==- //

  // -== BATCH MESSAGE START ==- //
  describe('Receive Batch Messages W/ Buffer', () => {
    before(function (done) {
      this.timeout(5000)
      let ID = 0

      const entries = []
      for (let i of new Array(10)) {
        let id = ++ID

        entries.push({
          Id: id.toString(),
          MessageBody: 'batch test'
        })
      }

      const params = {
        Entries: entries,
        QueueUrl: MESSAGE.QueueUrl
      }

      SQS.sendMessageBatch(params, err => {
        if (err) return done(err)
        done()
      })
    })

    it('- receive and process ', function (done) {
      this.timeout(10000)

      const opts = _.clone(DEFAULT_OPTS)
      opts.batchSize = 10
      opts.bufferSize = 20
      opts.bufferTimeout = 1000
      opts.messageReceiver = (message, acknowledge) => acknowledge(message)

      const sqs = new Consumer(opts)
      sqs.once('error', done)
      sqs.once('processing:error', done)
      sqs.once('message:processed', message => done())
      sqs.start()
    })
  })
  // -== BATCH MESSAGE END ==- //
})