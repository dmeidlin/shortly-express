var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: false,
  initialize: function () {
    this.on('creating', function (model, attrs, options) {
      var model = this;
      var promiseHash = Promise.promisify(bcrypt.hash);
      return promiseHash(model.get('password_digest'), null, null)
      .then(function(hash){
        model.set('password_digest', hash);
      });    
    });
  }
});

module.exports = User;
