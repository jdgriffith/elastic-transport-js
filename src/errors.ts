/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import * as http from 'http'
import { Result } from './types'

export class ElasticsearchClientError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'ElasticsearchClientError'
  }
}

export class TimeoutError extends ElasticsearchClientError {
  meta?: Result
  constructor (message: string, meta?: Result) {
    super(message)
    Error.captureStackTrace(this, TimeoutError)
    this.name = 'TimeoutError'
    this.message = message ?? 'Timeout Error'
    this.meta = meta
  }
}

export class ConnectionError extends ElasticsearchClientError {
  meta?: Result
  constructor (message: string, meta?: Result) {
    super(message)
    Error.captureStackTrace(this, ConnectionError)
    this.name = 'ConnectionError'
    this.message = message ?? 'Connection Error'
    this.meta = meta
  }
}

export class NoLivingConnectionsError extends ElasticsearchClientError {
  meta: Result
  constructor (message: string, meta: Result) {
    super(message)
    Error.captureStackTrace(this, NoLivingConnectionsError)
    this.name = 'NoLivingConnectionsError'
    this.message = message ?? 'Given the configuration, the ConnectionPool was not able to find a usable Connection for this request.'
    this.meta = meta
  }
}

export class SerializationError extends ElasticsearchClientError {
  data: Record<string, any>
  constructor (message: string, data: Record<string, any>) {
    super(message)
    Error.captureStackTrace(this, SerializationError)
    this.name = 'SerializationError'
    this.message = message ?? 'Serialization Error'
    this.data = data
  }
}

export class DeserializationError extends ElasticsearchClientError {
  data: string
  constructor (message: string, data: string) {
    super(message)
    Error.captureStackTrace(this, DeserializationError)
    this.name = 'DeserializationError'
    this.message = message ?? 'Deserialization Error'
    this.data = data
  }
}

export class ConfigurationError extends ElasticsearchClientError {
  constructor (message: string) {
    super(message)
    Error.captureStackTrace(this, ConfigurationError)
    this.name = 'ConfigurationError'
    this.message = message ?? 'Configuration Error'
  }
}

export class ResponseError extends ElasticsearchClientError {
  meta: Result
  constructor (meta: Result) {
    super('Response Error')
    Error.captureStackTrace(this, ResponseError)
    this.name = 'ResponseError'
    this.message = typeof meta.body === 'object'
      ? meta.body?.error?.type ?? 'Response Error'
      : 'Response Error'
    this.meta = meta
  }

  get body (): any | undefined {
    return this.meta.body
  }

  get statusCode (): number | undefined {
    if (typeof this.meta.body === 'object' && typeof this.meta.body.status === 'number') {
      return this.meta.body.status
    }
    return this.meta.statusCode
  }

  get headers (): http.IncomingHttpHeaders | undefined {
    return this.meta.headers
  }
}

export class RequestAbortedError extends ElasticsearchClientError {
  meta?: Result
  constructor (message: string, meta?: Result) {
    super(message)
    Error.captureStackTrace(this, RequestAbortedError)
    this.name = 'RequestAbortedError'
    this.message = message ?? 'Request aborted'
    this.meta = meta
  }
}