'use strict'

const EventEmitter = require('events')
const AWS = require('aws-sdk')
const Debug = require('debug')

const Errors = require('./errors')
const MemoryBuffer = require('./buffers/memory')

const REQUIRED_OPTS = [
  'queueUrl',
  'messageReceiver'
]

class Consumer extends EventEmitter {
  /**
   * SQS Consumer constructor
   * @param options
   */
  constructor (options) {
    super()

    this.constructor._validate(options)

    this.queueUrl = options.queueUrl
    this.messageReceiver = options.messageReceiver
    this.batchSize = options.batchSize || 1
    this.bufferSize = options.bufferSize
    this.bufferTimeout = options.bufferTimeout
    this.waitTimeSeconds = options.waitTimeSeconds
    this.visibilityTimeout = options.visibilityTimeout
    this.attributeNames = options.attributeNames || []
    this.messageAttributeNames = options.messageAttributeNames || []
    this.authenticationErrorTimeout = options.authenticationErrorTimeout || 10000

    this.sqs = options.sqs || new AWS.SQS({
          region: options.region || 'eu-west-1'
        })


    this.buffer = options.buffer || new MemoryBuffer({
          bufferSize: this.bufferSize,
          bufferTimeout: this.bufferTimeout
        })

    this.buffer.on('flush', this.messageReceiver)

    this.stopped = true
  }

  /**
   * Validate Consumer required options
   * @param options
   * @private
   */
  static _validate (options) {
    REQUIRED_OPTS.forEach(option => {
      if (!options[option]) {
        throw new Error(`Missing required option [${option}].`)
      }
    })

    if (options.batchSize < 1 || options.batchSize > 10) {
      throw new Error(`Invalid SQS [batchSize]. Must be between 1 and 10.`)
    }

    if (options.bufferSize <= options.batchSize) {
      throw new Error(`Invalid SQS [bufferSize]. Must be greater than [batchSize].`)
    }
  }

  /**
   * Poll SQS messages
   * @private
   */
  _poll () {
    const params = {
      QueueUrl: this.queueUrl,
      AttributeNames: this.attributeNames,
      MessageAttributeNames: this.messageAttributeNames,
      MaxNumberOfMessages: this.batchSize,
      WaitTimeSeconds: this.waitTimeSeconds,
      VisibilityTimeout: this.visibilityTimeout
    }

    if (!this.stopped) {
      Debug('Polling messages ...')
      this.sqs.receiveMessage(params, this._internalMessageReceiver)
    } else {
      this.emit('stopped')
    }
  }

  /**
   * Handle received messages internally first.
   * @param err
   * @param response
   * @private
   */
  _internalMessageReceiver (err, response) {
    if (err) {
      if (err.code === 403 || err.code === 'CredentialsError') {
        Debug(`SQS authentication error. Retry in: ${this.authenticationErrorTimeout/1000} seconds.`)
        this.emit('error', new Errors.SQSAuthenticationError('SQS authentication Error', err))
        return setTimeout(this._poll, this.authenticationErrorTimeout)
      } else {
        Debug(`SQS Receive Error ${err.message}`)
        return this.emit('error', new Errors.SQSError('SQS Receive Error', err))
      }
    }

    if (response && response.Messages && response.Messages.length > 0) {
      this._internalMessageProcessor(response.Messages, this._poll)
    } else {
      this._poll()
    }
  }

  _internalMessageProcessor (messages, poll) {
    if (this.bufferSize) {
      this.buffer.add(messages)
    } else {
      this.messageReceiver(messages)
    }

    poll()
  }

  /**
   * Start SQS message polling
   */
  start () {
    if (this.stopped) {
      Debug('Starting SQS Consumer...')
      this.stopped = false
      this._poll()
    }
  }

  /**
   * Stop SQS message polling
   */
  stop () {
    Debug('Stopping SQS Consumer...')
    this.stopped = true
  }
}

module.exports = Consumer
