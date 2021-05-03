const github = require('@actions/github');
const core = require('@actions/core');
const _ = require('lodash');

async function calculateNextVersion(previous) {
  console.log(previous);
  return '1.0.0';
}

async function run() {
  const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
  const defaultVersion = core.getInput('default-version');
  const versionPrefix = core.getInput('version-prefix');
  const octokit = github.getOctokit(GITHUB_TOKEN);
  const { context = {} } = github;
  const pattern = new RegExp(`^${versionPrefix}(\\d+)\\.(\\d+)\\.(\\d+)(-\\w[\\w\.]*)?(\\+\\w[\\w\\.]*)?$`, 'm');

  let response = await octokit.rest.repos.listTags({
    ...context.repo
  });

  if(response.status !== 200) {
    console.err('Error in calling github api.');
    process.exit(1);
  }

  let next = defaultVersion;
  let previous = _
    .chain(response.data)
    .map('name')
    .filter(name => pattern.test(name))
    .map(name => {
      return { name: name, matches: name.match(pattern) };
    })
    .head()
    .value()
  ;
  if(!previous) {
    console.log(`No previous version tag found. Using '${ next }' as next version.`)
  }
  else {
    console.log(`Previous version tag '${ previous.name }' found. Calculating next version.`)
    next = await calculateNextVersion(previous);
  }
  console.log(previous);
}

run();