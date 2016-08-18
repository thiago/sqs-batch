'use strict'

const EventEmitter = require('events')
const Debug = require('debug')('sqs-buffer')

const REQUIRED_OPTS = [
  'bufferSize',
  'bufferTimeout'
]

class Memory extends EventEmitter {
  constructor (options) {
    super()
    this.constructor._validate(options)

    this.bufferSize = options.bufferSize
    this.bufferTimeout = options.bufferTimeout

    this.items = []
    this.timerId = null

    this._flushBound = this._flush.bind(this)
  }

  /**
   * Validate Buffer options
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
  }

  /**
   * Start timer
   * @private
   */
  _startTimer () {
    Debug(`Buffer start timer for [${this.bufferTimeout/1000}] seconds`)
    if (!this.timerId) {
      this.timerId = setTimeout(this._flushBound, this.bufferTimeout)
    }
  }

  /**
   * Stop timer
   * @private
   */
  _stopTimer () {
    if (this.timerId) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  /**
   * Fire flush event and reset buffer
   * @private
   */
  _flush () {
    Debug('Buffer flush ...')
    this._stopTimer()
    this.emit('flush', this.items)
    this.items = []
  }

  /**
   * Add items into the buffer
   * @param {(*[]|*)} items - An item or an array of items
   * @returns {*}
   */
  add (items) {
    Debug(`Buffer add [${(Array.isArray(items)) ? items.length : 1}] item(s) ...`)
    const currentSize = this.items.length

    // Array of items
    if (Array.isArray(items)) {
      const possibleSize = currentSize + items.length

      // exceeded size
      if (possibleSize > this.bufferSize) {
        const available = this.bufferSize - currentSize
        const sliced = items.slice(0, available)
        const remaining = items.slice(available)

        Array.prototype.push.apply(this.items, sliced)
        this._flush()
        return this.add(remaining)
      }

      Array.prototype.push.apply(this.items, items)

      // completed size
      if (possibleSize === this.bufferSize) {
        return this._flush()
      }

      // incomplete size
      return this._startTimer()
    }

    // Single item
    this.items.push(items)

    // completed size
    if (this.items.length === this.bufferSize) {
      return this._flush()
    }

    // incomplete size
    return this._startTimer()
  }
}

module.exports = Memory
