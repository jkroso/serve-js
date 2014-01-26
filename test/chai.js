
var chai = require('chai')

window.should = chai.should()
window.expect = chai.expect
// chai.use(require('chai-spies'))

chai.Assertion.includeStack = true

module.exports = chai