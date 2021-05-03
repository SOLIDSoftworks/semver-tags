const github = require('@actions/github');
const core = require('@actions/core');
const _ = require('lodash');

async function calculateNextVersion(previous) {
  const defaultVersion = core.getInput('default-version');
  const versionPrefix = core.getInput('version-prefix');
  const incrementedValue = core.getInput('incremented-value');
  const prerelease = core.getInput('prerelease');
  const metadata = core.getInput('metadata');

  let next = versionPrefix;

  if(!previous) {
    next += defaultVersion;
    console.log(`No previous version tag. Using '${ next }' as next version.`);
  }
  else {
    console.log(`Previous version tag '${ previous.name }' found. Calculating next version.`);

    let major = previous.matches[1];
    let minor = previous.matches[2];
    let patch = previous.matches[3];

    if(incrementedValue === 'major') {
      major = parseInt(major) + 1
    }
    else if(incrementedValue === 'minor') {
      minor = parseInt(minor) + 1;
    }
    else if(incrementedValue === 'patch') {
      patch = parseInt(patch) + 1;
    }
    else {
      console.log(`Unsupported value in 'incremented-value'. Expected values: major,minor,patch.`);
      process.exit(1);
    }
    next += `${major}.${minor}.${patch}`;
  }
    
  if(prerelease) {
    console.log(`Prerelease configured. Adding '-${ prerelease }' to version number.`);
    next += `-${prerelease}`;
  }
  if(metadata) {
    console.log(`´Metadata configured. Adding '${ metadata }' to version number.`);
    next += `+${metadata}`;
  }
  console.log(`Next version: ${next}`);
  return next;
}

async function run() {
  const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
  const versionPrefix = core.getInput('version-prefix');

  const octokit = github.getOctokit(GITHUB_TOKEN);
  const { context = {} } = github;
  const pattern = new RegExp(`^${versionPrefix}(\\d+)\\.(\\d+)\\.(\\d+)(-(\\w[\\w\.]*))?(\\+(\\w[\\w\\.]*))?$`, 'm');

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
}

run();