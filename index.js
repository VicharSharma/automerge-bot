//Application to Automerge a PR if all Status Checks are passing and atleast MINIMAL REVIEWS are done
const {
  getPullrequest,
  tryMerge
} = require('./src/common');

var log4js = require('log4js');
log4js.configure({
  appenders: { debuglog: { type: 'file', filename: '/tmp/auto-merge-debug.log' } },
  categories: { default: { appenders: ['debuglog'], level: 'debug' } }
});
var logger = log4js.getLogger('debuglog');


module.exports = app => {

//Running app for event when the Check suite is completed
  app.on('check_suite.completed', async context => {
    const {
      check_suite
    } = context.payload;
    context.log(`DEBUG: Auto-merge app triggered on the event check_suite.completed`);
    logger.debug("DEBUG: Auto-merge app triggered on the event check_suite.completed");
    const {
      conclusion,
      pull_requests
    } = check_suite;

    if (conclusion !== 'success') {
      context.log(`INFO: Skipping Merge as Check Suite is not successful`);
      logger.debug("DEBUG:skipping merge as  check_suite conclusion == ${conclusion}");
      return;
    }
    // if Check Suite is success trying Merge
    if (pull_requests.length) {
      context.log(`DEBUG:Trying Merge check_suite conclusion == ${conclusion}`);
      logger.debug(`DEBUG:Trying Merge check_suite conclusion == ${conclusion}`);
      return tryMerge(context, pull_requests[0]);
    }
  });

// Running app on event when a check is run 
  app.on('check_run.completed', async context => {
    const {
      check_run
    } = context.payload;
    contextlog(`DEBUG: Auto-merge app triggered on the event check_run.completed`);
    logger.debug("DEBUG: Auto-merge app triggered on the event check_run.completed");
    const {
      conclusion,
      pull_requests
    } = check_run

    if (conclusion !== 'success') {
      context.log(`INFO: Skipping Merge as Check Run is not successful`);
      logger.debug(`DEBUG: skipping Merge as check_run conclusion == ${conclusion}`);
      return;
    }

    if (pull_requests.length) {
          context.log(`DEBUG:Trying Merge check_run conclusion == ${conclusion}`);
	  logger.debug(`DEBUG:Trying Merge check_run conclusion == ${conclusion}`);
      return tryMerge(context, pull_requests[0]);
    }
  });

//Running app when Pull Request Review is submitted
  app.on('pull_request_review.submitted', async context => {
    const {
      review,
      pull_request
    } = context.payload;
    context.log(`DEBUG: Auto-merge app triggered on the event pull_request_review.submitted`);
    logger.debug("DEBUG: Auto-merge app triggered on the event pull_request_review.submitted ");

    if (review.state !== 'approved') {
	  context.log(`INFO: Skipping Merge as Review Submitted is not approved`);
      logger.debug(`DEBUG: skipping Merge: review in state ${review.state}`);
      return;
    }
    context.log(`DEBUG:Trying Merge review in state ${review.state}`);
    logger.debug(`DEBUG:Trying Merge review in state ${review.state}`);
    return tryMerge(context, pull_request);
  });

//Running app when Pull request is opened,reopened or synchronized
  app.on([
    'pull_request.opened',
    'pull_request.reopened',
    'pull_request.synchronize'
  ], async context => {
    context.log(`DEBUG: Auto-merge app triggered on the event pull_request_review opened, reopened ,synchronized`);
    logger.debug("DEBUG: Auto-merge app triggered on the event pull_request_review opened, reopened ,synchronized");
	logger.debug("DEBUG:Trying Merge");
        context.log(`DEBUG:Trying Merge`);
	return tryMerge(context, context.payload.pull_request);
  });

//Running app when Status checks of the Pull request are updated
  app.on('status', async context => {
    const {
      state
    } = context.payload;

    if (state !== 'success') {
      context.log(`INFO: Skipping Mege as status ${state} is not succeded`);
      logger.debug(`DEBUG: skipping: status == ${state}`);
      return;
    }
    
    const pullRequests = await getPullrequest(context, context.payload);
    if (!pullRequests.length) {
      return;
    }

    // check, whether PR can be merged
    context.log(`DEBUG: Trying Merge for ${pullRequests.length} PRs`);
    for (var i = 0, len = pullRequests.length ; i < len; i++){
      mergeStatus = await   tryMerge(context, pullRequests[i]);
    }
    return; 
  });

  app.on('*', async context => {
    const {
      event,
      payload
    } = context;

    const {
      action
    } = payload;

    const eventName = action ? `${event}.${action}` : event;
    context.log(`INFO: Skipping eventName  ${eventName}`);
    logger.debug(`DEBUG: Skipping eventName  ${eventName}`);
  });

};
