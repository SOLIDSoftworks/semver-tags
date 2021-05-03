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

  let previous = _
    .chain(response)
    .map('name')
    //.filter(name => )
    .head()
    .value()
  ;

  console.log(previous);
}

run();