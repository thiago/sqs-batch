'use strict'

const EventEmitter = require('events')
const AWS = require('aws-sdk')
const Debug = require('debug')('sqs-buffer.receiver')
const _ = require('lodash')

const Errors = require('./errors')
const MemoryBuffer = require('./buffers/memory')

const REQUIRED_OPTS = [
  'queueUrl',
  'messageReceiver'
]

class Receiver extends EventEmitter {
  /**
   * SQS Receiver constructor
   * @param options
   */
  constructor (options) {
    super()

    // Validate options
    this.constructor._validate(options)

    this.ERROR_EVENT = 'error'
    this.MESSAGE_RECEIVED_EVENT = 'message:received'
    this.PROCESSING_ERROR_EVENT = 'processing:error'
    this.MESSAGE_PROCESSED_EVENT = 'message:processed'
    this.STOPPED_EVENT = 'stopped'

    // SQS options
    this.queueUrl = options.queueUrl
    this.batchSize = options.batchSize || 1
    this.waitTimeSeconds = options.waitTimeSeconds
    this.visibilityTimeout = options.visibilityTimeout
    this.attributeNames = options.attributeNames || []
    this.messageAttributeNames = options.messageAttributeNames || []

    // Consumer options
    this.messageReceiver = options.messageReceiver
    this.authenticationErrorTimeout = options.authenticationErrorTimeout || 10000

    // Buffer options
    this.bufferSize = options.bufferSize
    this.bufferTimeout = options.bufferTimeout || 10000

    // Instantiate SQS
    this.sqs = options.sqs || new AWS.SQS({
          region: options.region || 'eu-west-1'
        })

    // Instantiate Buffer if defined
    if (options.bufferSize) {
      this.buffer = options.buffer || new MemoryBuffer({
            bufferSize: this.bufferSize,
            bufferTimeout: this.bufferTimeout
          })
      this.buffer.on('flush', this._onFlush.bind(this))
    }

    this.stopped = true

    this._internalMessageReceiverBound = this._internalMessageReceiver.bind(this)
    this._deleteMessageBound = this.deleteMessage.bind(this)
    this._pollBound = this._poll.bind(this)
  }

  /**
   * Validate Receiver required options
   * @param options
   * @private
   */
  static _validate (options) {
    if (!options) throw new Error('Missing required options')

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
      this.sqs.receiveMessage(params, this._internalMessageReceiverBound)
    } else {
      this.emit(this.STOPPED_EVENT)
    }
  }

  /**
   * Call message received callback on flush event
   * @param messages
   * @private
   */
  _onFlush (messages) {
    Debug('Flush event received ...')
    this.messageReceiver(messages, this._deleteMessageBound)
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
        this._handleErrors(new Errors.SQSAuthenticationError('SQS authentication Error', err))
        return setTimeout(this._poll, this.authenticationErrorTimeout)
      } else {
        Debug(`SQS Receive Error ${err.message}`)
        return this._handleErrors(new Errors.SQSError('SQS Receive Error', err))
      }
    }

    if (response && response.Messages && response.Messages.length > 0) {
      this._internalMessageProcessor(response.Messages)
    } else {
      this._poll()
    }
  }

  /**
   * Process received messages internally first
   * @param messages
   * @private
   */
  _internalMessageProcessor (messages) {
    Debug('Messages received ...')
    this.emit(this.MESSAGE_RECEIVED_EVENT, messages)

    if (this.bufferSize) {
      Debug('Use Buffer message processing ... ')
      this.buffer.add(messages, this._pollBound)
    } else {
      Debug('Use Simple message processing ... ')
      this.messageReceiver(messages, this._deleteMessageBound)
    }
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

  /**
   * Delete one message from the queue
   * @param message
   * @param cb
   * @private
   */
  _deleteMessageOne (message, cb) {
    Debug('Deleting one message ...')

    const params = {
      QueueUrl: this.queueUrl,
      ReceiptHandle: message.ReceiptHandle || message[0].ReceiptHandle
    }

    this.sqs.deleteMessage(params, err => {
      if (err) return cb(new Errors.SQSError(`SQS delete message failed with error: ${err.message}`))
      Debug('Message deleted!')
      cb()
    })
  }

  _deleteMessageBatchPromise (params){
    return new Promise((resolve, reject) => {
      this.sqs.deleteMessageBatch(params, (err, data) => {
        if (err) {
          return reject(new Errors.SQSError(`SQS delete message batch failed with error: ${err.message}`))
        }
        if (data.Failed.length) {
          return reject(new Errors.SQSError(`SQS delete message batch failed with errors: ${data.Failed}`))
        }
        Debug('Batch deleted!')
        resolve(data)
      })
    })
  }
  /**
   * Delete multiple messages from the queue
   * @param messages
   * @param cb
   * @private
   */
  _deleteMessageBatch (messages, cb) {
    Debug('Deleting message batch ...')
    const promises = [];
    while(messages.length) {
      let chunk = messages.splice(0, 10)
      const params = {
        QueueUrl: this.queueUrl,
        Entries: chunk.map(item => {
          return {
            Id: item.MessageId,
            ReceiptHandle: item.ReceiptHandle
          }
        })
      }

      promises.push(this._deleteMessageBatchPromise(params));
    }

    return Promise.all(promises)
      .then(data => cb())
      .catch(err => cb(err));
  }

  /**
   * Handle Errors
   * @param error
   * @returns {*}
   * @private
   */
  _handleErrors (error) {
    switch (error.constructor) {
      case Errors.SQSError:
      case Errors.SQSAuthenticationError:
        return this.emit(this.ERROR_EVENT, error)
      case Errors.ConsumerDeleteError:
      case Errors.ProcessingError:
        Debug('Message processing error ...')
        return this.emit(this.PROCESSING_ERROR_EVENT, error)
    }
  }

  /**
   * Emit "message:process" event and re-poll
   * @param message
   * @private
   */
  _messageProcessed (message) {
    Debug('Message processed ...')

    this.emit(this.MESSAGE_PROCESSED_EVENT, message)
    this._poll()
  }

  /**
   * Delete Messages
   * @param message
   * @returns {*}
   */
  deleteMessage (message) {
    if (!message) {
      this._handleErrors(new Errors.ConsumerDeleteError('No message supplied to be deleted'))
      return this._poll()
    }

    if (_.isError(message)) {
      this._handleErrors(new Errors.ProcessingError(message))
      return this._poll()
    }

    if (!Array.isArray(message) || message.length === 1) {
      this._deleteMessageOne(message[0] || message, err => {
        if (err) {
          this._handleErrors(err)
          return this._poll()
        }
        this._messageProcessed(message)
      })
    } else {
      let messageCopy = [].concat(message);
      this._deleteMessageBatch(messageCopy, err => {
        if (err){
          this._handleErrors(err)
          return this._poll()
        }
        this._messageProcessed(message)
      })
    }
  }
}

module.exports = Receiver
