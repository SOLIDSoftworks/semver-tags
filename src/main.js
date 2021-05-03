const github = require('@actions/github');
const core = require('@actions/core');
const _ = require('lodash');

async function calculateNextVersion(previous) {
  const defaultVersion = core.getInput('default-version');
  const tagPrefix = core.getInput('tag-prefix');
  const incrementedValue = core.getInput('incremented-value');
  const prerelease = core.getInput('prerelease');
  const metadata = core.getInput('metadata');

  let next = '';

  if(!previous) {
    core.setOutput('core-version', defaultVersion);
    next += defaultVersion;
    console.log(`No previous version tag. Using '${ next }' as next version.`);
  }
  else {
    core.setOutput('previous-version', previous.name);
    console.log(`Previous version tag '${ previous.name }' found. Calculating next version.`);

    let major = previous.matches[1];
    let minor = previous.matches[2];
    let patch = previous.matches[3];

    if(incrementedValue === 'major') {
      major = parseInt(major) + 1;
      minor = 0;
      patch = 0;
    }
    else if(incrementedValue === 'minor') {
      minor = parseInt(minor) + 1;
      patch = 0;
    }
    else if(incrementedValue === 'patch') {
      patch = parseInt(patch) + 1;
    }
    else {
      console.log(`Unsupported value in 'incremented-value'. Expected values: major,minor,patch.`);
      process.exit(1);
    }
    let coreVersion = `${major}.${minor}.${patch}`;
    core.setOutput('core-version', coreVersion);
    next += coreVersion;
  }
    
  if(prerelease) {
    console.log(`Prerelease configured. Adding '-${ prerelease }' to version number.`);
    next += `-${prerelease}`;
  }
  if(metadata) {
    console.log(`Metadata configured. Adding '${ metadata }' to version number.`);
    next += `+${metadata}`;
  }
  core.setOutput('semantic-version', next);
  console.log(`Semantic version: ${next}`);
  return tagPrefix + next;
}

async function run() {
  const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
  const tagPrefix = core.getInput('tag-prefix');
  const dryRun = core.getInput('dry-run');

  const octokit = github.getOctokit(GITHUB_TOKEN);
  const { context = {} } = github;
  const pattern = new RegExp(`^${tagPrefix}(\\d+)\\.(\\d+)\\.(\\d+)(-(\\w[\\w\.]*))?(\\+(\\w[\\w\\.]*))?$`, 'm');

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
    .filter(name => pattern.test(name))
    .map(name => {
      return { name: name, matches: name.match(pattern) };
    })
    .head()
    .value()
  ;
  
  let next = await calculateNextVersion(previous);

  if(dryRun === 'true') {
    console.log('Action configured for dry run. Exiting.');
    process.exit(0);
  }

  console.log(`Creating new release tag: ${ next } `);
  await octokit.rest.repos.createRelease({
    ...context.repo,
    tag_name: next
  });
}

run();