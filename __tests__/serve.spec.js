const path = require('path')

const Service = require('../lib/Service')

const service = new Service(path.resolve(__dirname, '..'))

service.run('serve')
