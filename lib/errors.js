'use strict'

const CreateError = require('create-error')

module.exports = {
  SQSError: CreateError('SQSError'),
  SQSAuthenticationError: CreateError('SQSAuthenticationError'),
  ConsumerDeleteError: CreateError('ConsumerDeleteError'),
  ProcessingError: CreateError('ProcessingError')
}
