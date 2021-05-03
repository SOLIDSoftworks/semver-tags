const github = require('@actions/github');
const core = require('@actions/core');

async function run() {
  const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
  const octokit = github.getOctokit(GITHUB_TOKEN);
  const { context = {} } = github;

  let tags = await octokit.rest.repos.listTags({
    ...context.repo
  });

  console.log(tags);
}

run();