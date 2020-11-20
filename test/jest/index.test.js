const { TestScheduler } = require('jest')
const {} = require('../../')

test('usage test', () => {
  expect(1).toEqual(1)
  expect(1).not.toEqual(0)
})
