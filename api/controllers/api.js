var promise, options, message, process, errback, callback
  , Tag = require ('../models/tag')
  , Check = require ('../models/check')
  , utils = require('../utils')

  errback = function (err, req, res) {
    message = "Sorry, there was an error processing your query.";
    options = {message: message, err: err, status: 500, source: req.url}
    return utils.sendResponse(res, null, options);
  };

  callback = function(options) {
    if (!options.item) {
      message = "Sorry, " + options.req.params.type + " " + options.id
      message =+ " not found.";
      options = {message: message, status: 404, source: options.req.url}
      return utils.sendResponse(options.res, null, options);
    } else {
      response = {
        total: options.req.multiple ? options.item.length : 1
        , items: options.item
      };
      var opts = {status: options.status}
      return utils.sendResponse(options.res, response, opts);
    }
  };

process = function (promise, req, res, status) {
  var id = req.params.id || 'list'
  function _errback (err) {errback(err, req, res)};

  function _callback (item) {
    callback({item: item, req: req, res: res, status: status, id: id})
  };

  promise.addCallback(_callback).addErrback(_errback);
};

querify = function(query, options) {
  return query
    .limit(options.limit)
    .skip(options.limit * (options.page - 1))
    .sort(options.sort)
};

var exports = module.exports = {
  list: function(req, res) {
    req.multiple = true
    options = utils.parseRequest(req)
    query = req.ownedQuery.find(options.query)
    promise = querify(query, options).lean().exec()
    process(promise, req, res);
  },

  listUnpolled: function(req, res) {
    req.multiple = true
    Check.needingPoll(function (checks) {
      callback(_(checks).where({owner: req.user._id}));
    });
  },

  listCount: function(req, res) {
    req.multiple = true
    promise = req.ownedQuery
      .select('status')
      .aggregate([{$group: {_id: "$status", count: {$sum: 1}}}])
      .lean()
      .exec()

    process(promise, req, res);
  },

  // listStats: function(req, res) {
  //   var duration, cleanStat, stats
  //   req.multiple = true
  //   options = utils.parseRequest(req)

  //   if (!options.doc) {return callback(options.doc)}
  //   duration = utils.durations[options.period];
  //   cleanStat = function(stat) {stat.clean(duration)};
  //   query = req.ownedQuery.getStatsForPeriod(options).populate('check tag')

  //   if (options.single) {
  //     promise = query.findOne().lean().exec()
  //     promise.addErrback(errback).then(cleanStat).then(callback);
  //   } else {
  //     stats = [];
  //     querify(query, options)
  //       .stream()
  //       .on('error', errback)
  //       .on('data', function(stat) {stats.push(cleanStat(stat))})
  //       .on('close', function() {callback(stats)});
  //   }

  listAggregates: function(req, res) {
    req.multiple = true
    options = utils.parseRequest(req)

    query = req.ownedQuery
      .find(options.query)
      .where('timestamp').gte(options.begin).lte(options.end)

    promise = querify(query, options)
      .select('-tags')
      .populate('check')
      .aggregate([{$group: {_id: "$date", events: {$push: "$$ROOT"}}}])
      .lean()
      .exec()

    process(promise, req, res);
  },

  create: function(req, res) {
    options = utils.augmentBody(req)
    promise = req.Model.create(options);
    process(promise, req, res, 201);
  },

  update: function(req, res) {
    options = utils.augmentBody(req)
    query = req.ownedQuery.findOneAndUpdate({_id: req.params.id}, options)
    promise = query.lean().exec()
    process(promise, req, res);
  },

  get: function(req, res) {
    promise = req.ownedQuery.findOne({_id: req.params.id}).lean().exec()
    process(promise, req, res);
  },

  getByName: function(req, res) {
    promise = req.ownedQuery.findOne({name: req.params.id}).lean().exec()
    process(promise, req, res);
  },

  getByTag: function(req, res) {
    var thenback = function (tag) {
      return req.ownedQuery.find({tags: tag._id}).lean().exec();
    }

    promise = Tag.findOne({name: req.params.id}).select('_id').lean().exec()
    process(promise.then(thenback), req, res);
  },

  remove: function(req, res) {
    query = req.ownedQuery.findOneAndRemove({_id: req.params.id})
    promise = query.lean().exec()
    process(promise, req, res);
  },

  removeByName: function(req, res) {
    query = req.ownedQuery.findOneAndRemove({name: req.params.id})
    promise = query.lean().exec()
    process(promise, req, res);
  },

  toggle: function(req, res) {
    var id = req.params.id
    function _errback (err) {errback(err, req, res)};
    function _callback (err, item) {
      console.error(err)
      if (err) {return errback('err', req, res)}
      callback({item: item, req: req, res: res, id: id})
    };

    function findback (item) {
      item.toggle(function() {item.save(_callback)})
    }

    promise = req.ownedQuery.findOne({_id: id}).exec()
    promise.addCallback(findback).addErrback(_errback)
  },

  search: function(req, res) {
    promise = req.ownedQuery
      .aggregate(
        {$match: {name: {$regex: req.query.term, $options: 'i'}}},
        {$project: {_id: 0, label: '$name', value: '$name'}},
        {$sort: {label: 1}}
      )
      .lean()
      .exec()
    process(promise, req, res);
  }
};
