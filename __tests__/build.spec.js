const Service = require('../lib/Service')

const service = new Service(process.cwd())

service.run('build')
