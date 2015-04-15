require('coffee-script/register')

var middleware = require('./middleware')
  , api = require('./controllers/api')
  , account = require('./controllers/account')
  , password = require('./controllers/password')
  , config = require('../config/default')

var isAuthenticated = middleware.isAuthenticated
  , maybeAuthenticated = middleware.maybeAuthenticated
  , hydrate = middleware.hydrate
  , create = middleware.create
  , createPoller = middleware.createPoller
  , loadCheck = middleware.loadCheck
  , loadTag = middleware.loadTag
  , populateTags = middleware.populateTags

/*
 * The following code is python
 *
 * // resource creation order
 * // user -> monitor -> poller -> check -> notifier
 *
 * // init requirements
 * import requests
 *
 * // create a user
 * base = 'http://localhost:3333'
 * email, password = 'email', 'password'
 * data = {'name': name, 'email': email, 'password': password, 'confirmPassword': password}
 * r = requests.post(base + '/user', data=data)
 * auth = (email, password)
 *
 * // create a monitor
 * r = requests.post(base + '/monitor', auth=auth)
 *
 * // create a poller
 * monitor_id = r.json()['objects']['items']['_id']
 * data = {'monitor': monitor_id}
 * r = requests.post(base + '/poller/http', data=data, auth=auth)
 *
 * // create a check
 * url = 'http://localhost:3000/api/pages/'
 * data = {'poller': r.json()['objects']['items']['_id'], 'url': url}
 * r = requests.post(base + '/check', data=data, auth=auth)
 *
 * // create a notifier
 * data = {'check': r.json()['objects']['items']['_id']}
 * r = requests.post(base + '/notifier/console', data=data, auth=auth)
 *
 * // (un)pause the monitor
 * r = requests.get(base + '/monitor/' + monitor_id + '/toggle', auth=auth)
 */

var exports = module.exports = function(router) {
  router.route('/').get(function(req, res) {
    return res.send("Welcome to the " + config.brand + " API!");
  });

  router.route('/user')
    .get(maybeAuthenticated, account.userInfo)
    .post(account.signup)

  router.route('/auth')
    .get(account.verify)
    .post(isAuthenticated, account.sendVerification)

  router.route('/password')
    .get(password.reset)
    .post(password.recover)

  // Monitor
  router.route('/monitor')
    .get(isAuthenticated, hydrate, api.list)
    .post(isAuthenticated, create, api.create)

  router.route('/monitor/:id')
    .get(isAuthenticated, hydrate, api.get)
    .patch(isAuthenticated, hydrate, api.update)
    .delete(isAuthenticated, hydrate, api.remove)

  router.route('/monitor/:id/toggle').get(isAuthenticated, hydrate, api.toggle)

  // Pollers
  router.route('/poller').get(isAuthenticated, hydrate, api.list)
  router.route('/poller/:type?').post(isAuthenticated, create, api.create)

  router.route('/poller/:id')
    .get(isAuthenticated, hydrate, api.get)
    .patch(isAuthenticated, hydrate, api.update)
    .delete(isAuthenticated, hydrate, api.remove)

  // Checks
  router.route('/check')
    .get(isAuthenticated, hydrate, api.list)
    .post(isAuthenticated, create, api.create)

  // router.route('/checks/needingPoll')
  router.route('/check/unpolled')
    .get(isAuthenticated, api.listUnpolled)

  router.route('/check/count')
    .get(isAuthenticated, hydrate, api.listCount)

  // '/check/:id/test'
  router.route('/check/:id')
    .get(isAuthenticated, hydrate, api.get)
    .patch(isAuthenticated, hydrate, api.update)
    .delete(isAuthenticated, hydrate, api.remove)

  // '/checks/:id/pause'
  router.route('/check/:id/toggle').get(isAuthenticated, hydrate, api.toggle)

  // router.route('/tags/:name/checks')
  router.route('/check/tagged/:id')
    .get(isAuthenticated, hydrate, api.getByTag)

  // Pings
  router.route('/ping')
    .get(isAuthenticated, hydrate, api.list)
    .post(isAuthenticated, create, loadCheck, api.create)

  // Tags
  router.route('/tag')
    .get(maybeAuthenticated, hydrate, api.list)

  router.route('/tag/search')
    .get(isAuthenticated, hydrate, api.search)

  router.route('/tag/:id')
    .get(maybeAuthenticated, hydrate, api.get)
    .patch(isAuthenticated, hydrate, api.update)
    .delete(maybeAuthenticated, hydrate, api.remove)

  router.route('/tag/name/:id')
    .get(maybeAuthenticated, hydrate, api.getByName)
    .delete(maybeAuthenticated, hydrate, api.removeByName)

  // Stats
  // router.route('/tags/:name/stats/:period')
  // router.route('/tags/:name/stats/:period/:timestamp')
  // router.route('/stat/tagged/:id/:period/:timestamp?')
  //   .get(isAuthenticated, hydrate, loadTag, api.listStats)

  // router.route('/checks/:id/stat/:period')
  // router.route('/checks/:id/stat/:period/:timestamp')
  // router.route('/stat/check/:id/:period/:timestamp?')
  //   .get(isAuthenticated, hydrate, loadCheck, api.listStats)

  // Events
  // router.route('/pings/events')
  router.route('/event/:period/:timestamp?')
    .get(isAuthenticated, hydrate, api.listAggregates)

  // router.route('/checks/:id/events')
  router.route('/event/check/:id/:period/:timestamp?')
    .get(isAuthenticated, hydrate, loadCheck, api.listAggregates)

  // router.route('/tags/:name/events')
  router.route('/event/tagged/:id/:period/:timestamp?')
    .get(isAuthenticated, hydrate, loadTag, api.listAggregates)

  // Notifiers
  router.route('/notifier').get(isAuthenticated, hydrate, api.list)
  router.route('/notifier/:type?').post(isAuthenticated, create, api.create)

  router.route('/notifier/:id')
    .get(isAuthenticated, hydrate, api.get)
    .patch(isAuthenticated, hydrate, api.update)
    .delete(isAuthenticated, hydrate, api.remove)

  return router
};
