// indexed 'on' field to the comments
comments.find({on: POST_ID}) // find all comments for a post
posts.aggregate([{$unwind: "$comments"}, {$match: {"comments.name": "abc"}}])
inventory.aggregate([{$unwind: "$sizes"}])

// find all events for a user
events.find({_id: {$in: user.events}})
events.find({owner: user._id}})
users.find({_id: user._id}, {events: 1})

// find all users for an event
users.find({_id: {$in: event.attendees}})
users.find({"events": event}, {_id: 1, username: 1})

// find all people who like a given item.
// select the fields we want to deal with
// unwind 'likes', which will create a document for each like
// group everything by the like and then add each name with that like to
// the set for the like
Person.aggregate(
  {$project: {name: 1, likes: 1}},
  {$unwind: "$likes"},
  {$group: {_id: {likes: "$likes"}, likers: {$addToSet: "$name"}}},
  function (err, result) {console.log(result)});

// return just plain javascript objects, not MongooseDocuments
Person.find({age: {$lt: 1000}}).sort('age').limit(2).lean();

// mapreduce
o = {
  query: {age: {$lt: 1000}}
  map: function () {emit(this.gender, this.age)},
  // array of ages that are grouped by gender
  reduce: function (gender, ages) {return Array.sum(ages)},
  verbose: true,
};

Person.mapReduce(o, function (err, results, stats) {};)

// promises
prom = Person.find({age: {$lt: 1000}}).exec();
prom.addBack(function () {console.log("completed")});
prom.addCallback(function () {console.log("Successful Completion!")});
prom.addErrback(function () {console.log("Fail Boat")});
prom.then(function (people) {
  var ids = people.map(function (person) {return person._id});
  return Person.find({_id: {$nin: ids}}).exec();
}).then(function (oldest) {})

// queries
query = Person.find({age: {$lt: 1000}});
query.sort('birthday');
query.select('name');
query.where('age').gt(21);
query.exec(function (err, results) {})
