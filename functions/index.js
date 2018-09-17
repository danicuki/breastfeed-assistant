const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
var db = admin.firestore();
var FieldValue = admin.firestore.FieldValue;
var blog = db.collection("breastfeed_log");

const BEGIN = 'Begin breastfeed';
const END = 'Breastfeed finished';

exports.hello = functions.https.onRequest((request, response) => {
  
  console.log(request.body);

  db.collection("requests").add(request.body);
  
  var intent = request.body.queryResult.intent;
  var user = userFromRequest(request);

  if (intent.displayName === "ask_start_time") {
    return askStartTime(user, response);
  } else if (intent.displayName === "ask_finish_time") {
    return askFinishTime(user, response);
  }

  blog.add({
    timestamp: FieldValue.serverTimestamp(),
    intent: intent,
    user: user
  }).then(doc => {
    if (intent.displayName === BEGIN) {
      breastFeedBegin(response);
    } else if (intent.displayName === END) {
      doc.get().then( x => {
        endTimestamp = x.data().timestamp;

        lastStartQuery(user).get().then(items => {
          lastStart = items.docs[0].data();
          minutes = Math.round((endTimestamp - lastStart.timestamp) / 1000 / 60);

          breastFeedCountQuery(1, user).get().then( lastDayBegins => {
            feedCount = lastDayBegins.docs.length;
            response.send({
              "fulfillmentText": `Cool, last breastfeed took ${minutes} minutes. You already breastfed ${feedCount} times in the last day`
            });    
          });
        });
      });
    }
  });
});

function askFinishTime(user, response) {
  lastQuery(user, END).get().then(items => {
    let lastEnd = items.docs[0].data();
    let minutes = Math.round((Date.now() - lastEnd.timestamp) / 1000 / 60);
    let timeStr = lastEnd.timestamp.toLocaleTimeString('short');

    response.send({
      "fulfillmentText": `Your breast feed ended ${minutes} minutes ago. It was ${timeStr} when you finished.`
    });

  });
}


function askStartTime(user, response) {
  lastStartQuery(user).get().then(items => {
    let lastStart = items.docs[0].data();
    let minutes = Math.round((Date.now() - lastStart.timestamp) / 1000 / 60);
    let timeStr = lastStart.timestamp.toLocaleTimeString('short');

    response.send({
      "fulfillmentText": `Your breast feed started ${minutes} minutes ago. It was ${timeStr} when you started.`
    });

  });
}

function breastFeedBegin(response) {
  response.send({
    "fulfillmentText": "Ok, starting breastfeed. Tell me when you finish it."
  });
}

function userFromRequest(request) {
  user = undefined;
  orig = request.body.originalDetectIntentRequest;
  if (orig && orig.payload) {
    user = orig.payload.user  
  }
  return user;
}

function queryWithUser(query, user) {
  if (user) {
    return query.where("user.userId", "==", user.userId);
  }
  return query;
}

function breastFeedCountQuery(days = 1, user = undefined) {
  var query = blog.where(
    "intent.displayName", "==", BEGIN
  ).where(
    "timestamp", ">", new Date(Date.now() - days * 24 * 3600 * 1000)
  );

  return queryWithUser(query, user);
}

function lastQuery(user = undefined, action = BEGIN) {
  query = blog.where("intent.displayName", "==", action);
  return queryWithUser(query, user).orderBy("timestamp", "desc").limit(1);
}

function lastStartQuery(user = undefined) {
  return lastQuery(user, BEGIN);
}

function lastEndQuery(user = undefined) {
  return lastQuery(user, END);
}


// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });
