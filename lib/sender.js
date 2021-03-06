'use strict'

const Debug = require('debug')('sqs-buffer.sender')
const AWS = require('aws-sdk')
const UUID = require('uuid')

const Errors = require('./errors')

const REQUIRED_OPTS = [
  'queueUrl'
]

class Sender {
  /**
   * SQS Sender Constructor
   * @param options
   */
  constructor (options) {
    this.constructor._validate(options)

    // SQS options
    this.queueUrl = options.queueUrl
    this.batchSize = options.batchSize || 10

    // Instantiate SQS
    this.sqs = options.sqs || new AWS.SQS({
      region: options.region || 'eu-west-1'
    })
  }

  /**
   * Validate Sender required options
   * @param {Object} options - Constructor options
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
      throw new Error(`SQS batch size must be between 1 and 10. [${options.batchSize}] specified.`)
    }
  }

  /**
   * Generate message Id
   * @returns {string}
   */
  static messageId () {
    return UUID.v4()
  }

  /**
   * Create message attribute
   * @param {string} type - Attribute data type
   * @param {String|Buffer|Array<String>|Array<Buffer>} value
   * @returns {{DataType: String, _DataType_Value: String|Buffer}}
   * @private
   */
  _messageAttributes (type, value) {
    return {
      DataType: type,
      [`${type}Value`]: value
    }
  }

  /**
   * Validate Object message attribute
   * @param {Object} message - Message object
   * @returns {{Id: (*|String|string), MessageBody: HTMLElement}|*}
   * @private
   */
  _formatObjectMessage (message) {
    let entry

    if (!message.body) {
      throw new Errors.InvalidMessage('Object message must include "body" property')
    }

    entry = {
      Id: message.id || this.constructor.messageId(),
      MessageBody: message.body
    }

    if (message.messageAttributes) {
      if (typeof message.messageAttributes !== 'object') {
        throw new Errors.InvalidMessage('message.messageAttributes must be an object')
      }

      entry.MessageAttributes = message.messageAttributes
    }

    return entry
  }

  /**
   * Prepare message for SQS
   * @param {string} message - Message body
   * @returns {{Id: *, MessageBody: string}}
   * @private
   */
  _formatMessage (message) {
    if (typeof message === 'string') {
      return {
        Id: this.constructor.messageId(),
        MessageBody: message
      }
    }

    if (typeof message === 'object') {
      return this._formatObjectMessage(message)
    }

    throw new Errors.InvalidMessage(`Message type must be string, [${typeof message}] given`)
  }

  /**
   * Send messages in batches
   * @param entries
   * @returns {Promise}
   * @private
   */
  _sendBatch (entries) {
    let successful = []
    let failed = []

    const params = {
      QueueUrl: this.queueUrl,
      Entries: entries
    }

    return new Promise((resolve, reject) => {
      this.sqs.sendMessageBatch(params, (err, res) => {
        if (err) return reject(err)
        return resolve(res)
      })
    })
  }

  /**
   * Create a String message attribute object
   * @param {String} value - Attribute value
   * @returns {{DataType}|{DataType: *}}
   */
  createStringAttribute (value) {
    return this._messageAttributes('String', value)
  }

  /**
   * Create a Binary message attribute object
   * @param {Buffer} value - Attribute value
   * @returns {{DataType}|{DataType: *}}
   */
  createBinaryAttribute (value) {
    return this._messageAttributes('Binary', value)
  }

  /**
   * Send SQS messages
   * @param {string|Array} message - A message or an array of messages
   * @returns {Promise.<Object>}
   */
  send (message) {
    let entries
    let messages = Array.isArray(message) ? message : [ message ]

    if (messages.length > this.batchSize) {
      Promise.reject(new Errors.InvalidMessage(`Message batch must not be greater than ${this.batchSize}.`))
    }

    Debug(`Sending [${messages.length}] messages ...`)

    try {
      entries = messages.map(m => this._formatMessage(m))
    } catch (err) {
      return Promise.reject(err)
    }

    return this._sendBatch(entries)
  }
}

module.exports = Sender
