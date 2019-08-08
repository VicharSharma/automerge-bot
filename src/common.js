const DEFAULT_MIN_APPROVALS = 1;
const DELETE_BRANCH = 'TRUE';
const APPROVED = 'APPROVED';
const REVIEWS_MISSING = 'REVIEWS_MISSING';
const CHANGES_REQUESTED = 'CHANGES_REQUESTED';
const CHECKS_MISSING = 'CHECKS_MISSING';
const CHECKS_FAILED = 'CHECKS_FAILED';
const SUCCESS = 'SUCCESS';
const FAILURE = 'FAILURE';

var log4js = require('log4js');
log4js.configure({
  appenders: { debuglog: { type: 'file', filename: '/tmp/auto-merge-debug.log' } },
  categories: { default: { appenders: ['debuglog'], level: 'debug' } }
});
var logger = log4js.getLogger('debuglog');

//Function to get all the Pull Requests for the repo
async function getPullrequest(context, status) {

  const {
    sha,
    repository,
    branches
  } = status;

  logger.debug(`INFO : Checking sha of status is same as the branch for commit`);
  context.log.debug (`INFO : Checking sha of status is same as the branch for commit`);
  const branch = branches.find((branch) => {
    return branch.commit.sha === sha;
  });

  if (!branch) {
    logger.debug('INFO: None of the branch matches ref');
    context.log('INFO: None of the branch matches ref');
    return null;
  }
  logger.debug(`INFO: Checking for branch ${branch.name}`);
  context.log(`INFO: Checking for branch ${branch.name}`);
  const {
    data: pullRequests
  } = await (context.github).pullRequests.list(context.repo({
    ref: `${repository.name}:${branch.name}`,
    state: 'open'
  }));

  logger.debug(`INFO: Total Number of PRs found: ${pullRequests.length} `);
  context.log.debug(`INFO: Total Number of PRs found: ${pullRequests.length} `);

  if (!pullRequests.length) {
    logger.debug('Skipping: None of the branch matches ref');
    context.log('Skipping: None of the branch matches ref');
    return null;
  }
 
  if (pullRequests.length > 1){
      logger.debug('INFO: More than one pull request matches the ref, but returning only one');
      context.log('INFO: More than one pull request matches the ref, but returning only one');
  }
  return pullRequests;
}

async function checkBranchProtection(context, base) {

  try {
    await (context.github).repos.getBranchProtection(
      context.repo({
        branch: base.ref
      })
    );

    return true;
  } catch (e) {

    if (e.code === 404) {
      const err = JSON.parse(e.message);

      if (err.message === 'Branch not protected') {
        return false;
      }
    }
    logger.debug('ERROR: failed to fetch branch protection status', e);
    context.log.error('failed to fetch branch protection status', e);

    return null;
  }

}

function combineSuiteStatus(status, suite) {

  if (status && status !== SUCCESS) {
    return status;
  }

  if (suite.status !== 'completed') {
    return CHECKS_PENDING;
  }

  if (suite.conclusion !== 'success') {
    return CHECKS_FAILED;
  }

  return SUCCESS;
}

function isStatusValid (suite) {

  const {
    status,
    conclusion
  } = suite;

  if (status === 'queued' && !conclusion) {
    return false;
  }

  // regard all uncompleted suites as relevant
  if (status !== 'completed') {
    return true;
  }

  // ignore neutral suites
  if (conclusion === 'neutral') {
    return false;
  }

  return true;
}
//Function for Checking the Status of PR
async function getStatusApproval(context, pullRequest) {
  const {
    head
  } = pullRequest;

  const {
    sha
  } = head;

  const {
    data: statusForRef
  } = await (context.github).repos.getCombinedStatusForRef(context.repo({
    ref: sha
  }));

  const {
    statuses
  } = statusForRef;

  const statusState = statusForRef.state.toUpperCase();
  
  // Rejecting the Merge early if Status check has failed
  if (statuses.length && statusState !== SUCCESS) {
    logger.debug(`INFO: Status checks have failed : combined status = ${statusState}`);
    context.log(`INFO: Status checks have failed : combined status = ${statusState}`);
    return `STATUS_${statusState}`;
  }

  const {
    data: suitesForRef
  } = await (context.github).checks.listSuitesForRef(context.repo({
    ref: sha
  }));

  const {
    check_suites
  } = suitesForRef;

  if (check_suites.length === 0) {
    if (statuses.length === 0) {
      return CHECKS_MISSING;
    } else {
      // SUCCESS
      logger.debug(`INFO:Success state returned for tests`);
      context.log(`INFO:Success state returned for tests`);
      return statusState;
    }
  }

    const checkSuitesStatus =
    check_suites
      .filter(isStatusValid)
      .reduce(combineSuiteStatus, null);

  // returns CHECKS_FAILED || CHECKS_PENDING || SUCCESS
  return checkSuitesStatus || CHECKS_MISSING; 
}
//function to get the last review by a User
function getEffectiveReviews(reviews) {

  const userReviews = { };

  const effectiveReviews = [];
  for (let i = reviews.length - 1; i >= 0; i--) {

    const review = reviews[i];

    const userLogin = review.user.login;
    // we already found a user review with precedence
    if (userReviews[userLogin]) {
      continue;
    }
    effectiveReviews.unshift(review);
    userReviews[userLogin] = true;
  }
  return effectiveReviews;
}
//Function to get see if MINIMUM number of reviews required 
async function getReviewApproval(context, pullRequest) {

  const {
    number
  } = pullRequest;

 
  minApprovals = DEFAULT_MIN_APPROVALS

  logger.debug(`INFO:Checking if #${number} is approved via reviews`);
  context.log.debug(`INFO:Checking if #${number} is approved via reviews`);

  const {
    data: reviews
  } = await (context.github).pullRequests.listReviews(context.repo({
    number
  }));

  const effectiveReviews = getEffectiveReviews(reviews);
  const allApproved = effectiveReviews.filter(review => review.state === APPROVED);
  const allRejected = effectiveReviews.filter(review => review.state === CHANGES_REQUESTED)

  if (allApproved.length < minApprovals) {
    logger.debug(`INFO: #${number} lacks minApprovals=${minApprovals}, skipping merge`);
    context.log.debug(`INFO: #${number} lacks minApprovals=${minApprovals}, skipping merge`);

    return REVIEWS_MISSING;
  }
  return APPROVED;
}
//Function to test if Merge can be done based on Status Checks and Review Status
async function isMergable(context, pullRequest) {

  const {
    number,
    base
  } = pullRequest;

  const branchProtected = await checkBranchProtection(context, base);

  if (branchProtected === null) {
    return false;
  }
  if (branchProtected) {
    logger.debug('branch is protected, skipping merge check');
    context.log.debug('branch is protected, skipping merge check');
    return true;
  }

  logger.debug(`INFO: Checking #${number} status and reviews`); 
  context.log.debug(`INFO: Checking #${number} status and reviews`);

  // Checking Status Checks set for PRs
  const statusApproval = await getStatusApproval(context, pullRequest);
  if (statusApproval !== SUCCESS) {
    logger.debug(`INFO: Merge will be skipped as #${number} failed status check (${statusApproval})`);
    context.log(`INFO: Merge will be skipped as #${number} failed status check (${statusApproval})`);
    return false;
  }

  // Checking Review is done as per Minimum Number of Reviews set
  const reviewApproval = await getReviewApproval(context, pullRequest);
  if (reviewApproval !== APPROVED) {
    logger.debug(`INFO: Merge will be skipped as : #${number} failed review check (${reviewApproval})`);
    context.log(`INFO: Merge will be skipped as : #${number} failed review check (${reviewApproval})`);
    return false;
  }

  return true;
}

async function tryMerge(context, pullRequest) {
  const{
    number
  } = pullRequest;
  logger.debug(`INFO: Checking if Pull request : #${number} can be merged`);
  context.log(`INFO: Checking if Pull request : #${number} can be merged`);
  const canMerge = await isMergable(context, pullRequest);

  if (!canMerge) {
    logger.debug(`INFO: Skipping merge of Pull request #${number} as status checks have failed`);
    context.log(`INFO: Skipping merge of Pull request #${number} as status checks have failed`);
    return false;
  }

  const mergeStatus = await merge(context, pullRequest);
  if (mergeStatus) {
    logger.debug(`INFO: Successfully merged Pull Request #${number}`);
    context.log(`INFO: Successfully merged Pull Request #${number}`);
	const deleteBranchStatus = await deleteBranchAftermerge(context, pullRequest);
    return true;
  } else {
    logger.debug(`WARN: Failed to merge Pull Request #${number}`);
    context.log(`WARN: Failed to merge Pull Request #${number}`);
    return false;
  }
}

async function deleteBranchAftermerge(context, pullRequest){
	
	const owner = context.payload.repository.owner.login
	const branchName = context.payload.pull_request.head.ref
	const repo = context.payload.repository.name
	const ref = `heads/${branchName}`
        logger.debug(`INFO: Trying to delete ${owner}/${repo}/${ref}`);
        context.log(`INFO: Trying to delete ${owner}/${repo}/${ref}`);
	try {
		await context.github.gitdata.deleteRef({owner, repo, ref });
                logger.debug(`INFO: Successfully deleted ${owner}/${repo}/${ref}`);
		context.log(`INFO: Successfully deleted ${owner}/${repo}/${ref}`);
		return true;
  } catch (ex) {
    logger.debug(ex, `Failed to delete ${owner}/${repo}/${ref}`);
    context.log.error(ex, `Failed to delete ${owner}/${repo}/${ref}`);
	return false;
  }
}

async function merge(context, pullRequest) {
  const {
    number,
    head
  } = pullRequest;

  const {
    sha
  } = head;
  logger.debug(`INFO: Merging of PR #${number} started`);
  context.log.debug(`INFO: Merging of PR #${number} started`);

  try {
    await (context.github).pullRequests.merge(context.repo({
      number,
      sha,
      merge_method: 'squash'
    }));
	return true;
  } catch (ex) {
    if (ex.code === 405) {
      const err = JSON.parse(ex.message);
      logger.debug(`ERROR: Merge of PR #${number} failed: ${err.message}`);
      context.log.debug(`ERROR: Merge of PR #${number} failed: ${err.message}`);
    } else {
      logger.debug('ERROR: Merge failed', ex);
      context.log.error('ERROR: Merge failed', ex);
    }

    return false;
  }
}

module.exports = {
  getPullrequest,
  getReviewApproval,
  getStatusApproval,
  getEffectiveReviews,
  isMergable,
  merge,
  tryMerge,
  isStatusValid,
  combineSuiteStatus,
  deleteBranchAftermerge,
  checkBranchProtection
};
