const github = require('@actions/github');
const core = require('@actions/core');
const _ = require('lodash');

async function run() {
  const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
  const octokit = github.getOctokit(GITHUB_TOKEN);
  const { context = {} } = github;

  let response = await octokit.rest.repos.listTags({
    ...context.repo
  });

  if(response.status !== 200) {
    console.err('Error in calling github api.');
    process.exit(1);
  }

  let previous = _
    .chain(response.data)
    .map('name')
    //.filter(name => )
    .head()
    .value()
  ;

  console.log(previous);
}

run();