var exports = module.exports = function autoExpirePlugin (schema, seconds) {
  schema.add({createdAt: {type: Date, default: new Date()}})
  schema.index({createdAt: 1}, {expireAfterSeconds: seconds})
}
