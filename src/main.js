const github = require('@actions/github');
const core = require('@actions/core');
const _ = require('lodash');


const versionPattern = new RegExp(`^${tagPrefix}(\\d+)\\.(\\d+)\\.(\\d+)(-(\\w[\\w\.]*))?(\\+(\\w[\\w\\.]*))?$`, 'm');
const nextVersion = function(semver, major, minor) {
  this.semver = semver;
  this.major = major;
  this.minor = minor;
};

async function calculateNextVersion(previous) {
  const defaultVersion = core.getInput('default-version');
  const tagPrefix = core.getInput('tag-prefix');
  const incrementedValue = core.getInput('incremented-value');
  const prerelease = core.getInput('prerelease');
  const metadata = core.getInput('metadata');

  let semanticVersion = '';
  let majorVersion = '';
  let minorVersion = '';
  let major = '';
  let minor = '';
  let patch = '';

  if(!previous) {
    let matches = defaultVersion.match(versionPattern);
    major = matches.matches[1];
    minor = matches.matches[2];
    core.setOutput('core-version', defaultVersion);
    semanticVersion += defaultVersion; 
    console.log(`No previous version tag. Using '${ semanticVersion }' as next version.`);
  }
  else {
    core.setOutput('previous-version', previous.name);
    console.log(`Previous version tag '${ previous.name }' found. Calculating next version.`);

    major = previous.matches[1];
    minor = previous.matches[2];
    patch = previous.matches[3];

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
    semanticVersion += coreVersion;
    majorVersion += major;
    minorVersion += `${major}.${minor}`
  }

  if(prerelease) {
    console.log(`Prerelease configured. Adding '-${ prerelease }' to version number.`);
    next += `-${prerelease}`;
  }
  if(metadata) {
    console.log(`Metadata configured. Adding '+${ metadata }' to version number.`);
    next += `+${metadata}`;
  }
  core.setOutput('semantic-version', semanticVersion);
  console.log(`Semantic version: ${semanticVersion}`);
  return new nextVersion(tagPrefix + semanticVersion, tagPrefix + majorVersion, tagPrefix + minorVersion);
}

async function run() {
  const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
  const tagPrefix = core.getInput('tag-prefix');
  const dryRun = core.getInput('dry-run');
  const addMinorTag = core.getInput('add-minor-tag');
  const addMajorTag = core.getInput('add-major-tag');
  const prerelease = !!core.getInput('prerelease');

  const octokit = github.getOctokit(GITHUB_TOKEN);
  const { context = {} } = github;

  let page = 1;
  let tags = [];
  while(true) {
    const response = await octokit.repos.listTags({
      owner: context.repo.owner,
      repo: context.repo.repo,
      page,
      per_page: 100
    });
    if(response.status !== 200) {
      console.err('Error in calling github api.');
      process.exit(1);
    }
    tags = tags.concat(response.data);
    if(response.data.length < 100) {
      break;
    }
    page++;
  }

  let previous = _
    .chain(tags)
    .map('name')
    .filter(name => versionPattern.test(name))
    .map(name => {
      return { name: name, matches: name.match(versionPattern) };
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
    tag_name: next.semver,
    prerelease: prerelease
  });

  if()
}

run();
