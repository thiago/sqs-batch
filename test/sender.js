/* eslint-env mocha */
'use strict'

require('dotenv').config({ silent: true })
const _ = require('lodash')
const AWS = require('aws-sdk')
const Code = require('code')
const expect = Code.expect

const Sender = require('../lib/sender')

const SQS = new AWS.SQS({
  region: process.env.AWS_SQS_REGION,
  accessKeyId: process.env.AWS_SQS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SQS_SECRET_ACCESS_KEY
})

const DEFAULT_OPTS = {
  queueUrl: process.env.TEST_QUEUE_URL,
  sqs: SQS
}

describe('SQS Sender', () => {
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

  })
  // -== CONSTRUCTOR OPTIONS END ==- //

  // -== SEND SINGLE MESSAGE START ==- //
  describe('Send Single Message', () => {
    let sender

    before(() => {
      sender = new Sender(DEFAULT_OPTS)
    })

    it('- string', (done) => {
      let message = 'Sender test message'
      sender
        .send(message)
        .then(res => {
          expect(res.Successful).to.have.length(1)
          done()
        })
        .catch(done)
    })

    it('- object', (done) => {
      let message = {
        body: 'Sender test message'
      }
      sender
        .send(message)
        .then(res => {
          expect(res.Successful).to.have.length(1)
          done()
        })
        .catch(done)
    })
  })
  // -== SEND SINGLE MESSAGE END ==- //
})