const github = require('@actions/github');
const core = require('@actions/core');
const _ = require('lodash');

const nextVersion = function(semver, major, minor) {
  this.semver = semver;
  this.major = major;
  this.minor = minor;
};

function generateVersionPattern(tagPrefix, tagPrefixOptional = false) {
  console.log('Generating version regex pattern');
  let optional = '';
  if(!!tagPrefix && tagPrefixOptional) {
    optional = '?';
  }
  let pattern = `^${tagPrefix}${optional}(\\d+)\\.(\\d+)\\.(\\d+)(-(\\w[\\w\.]*))?(\\+(\\w[\\w\\.]*))?$`;
  console.log(`Generated pattern: ${pattern}`);
  return new RegExp(pattern, 'm');
}

async function calculateNextVersion(previous) {
  const defaultVersion = core.getInput('default-version');
  const incrementedValue = core.getInput('incremented-value');
  const prerelease = core.getInput('prerelease');
  const metadata = core.getInput('metadata');
  const tagPrefix = core.getInput('tag-prefix');
  const versionPattern = generateVersionPattern(tagPrefix, true);

  let semanticVersion = '';
  let majorVersion = '';
  let minorVersion = '';
  let major = '';
  let minor = '';
  let patch = '';

  if(!previous) {
    console.log(`No previous version tag. Using '${ defaultVersion }' as next version.`);
    let match = defaultVersion.match(versionPattern);
    major = match[1];
    minor = match[2];
    core.setOutput('core-version', defaultVersion);
    semanticVersion += defaultVersion; 
  }
  else {
    console.log(`Previous version tag '${ previous.name }' found. Calculating next version.`);
    core.setOutput('previous-version', previous.name);

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
  }
  majorVersion += major;
  minorVersion += `${major}.${minor}`

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
  console.log(`Major version: ${majorVersion}`);
  console.log(`Minor version: ${minorVersion}`);
  return new nextVersion(tagPrefix + semanticVersion, tagPrefix + majorVersion, tagPrefix + minorVersion);
}

async function run() {
  const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
  const dryRun = core.getInput('dry-run');
  const addMinorTag = core.getInput('add-minor-tag');
  const addMajorTag = core.getInput('add-major-tag');
  const prerelease = !!core.getInput('prerelease');
  const tagPrefix = core.getInput('tag-prefix');
  const versionPattern = generateVersionPattern(tagPrefix);

  const octokit = github.getOctokit(GITHUB_TOKEN);
  const { context = {} } = github;

  let page = 1;
  let tags = [];
  console.log('Getting previous tags');
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

  console.log(`Creating new release tag: ${ next.semver } `);
  await octokit.rest.repos.createRelease({
    ...context.repo,
    tag_name: next.semver,
    prerelease: prerelease
  });

  if(addMajorTag) {
    if(prerelease) {
      console.log("Release is a prerelease. Skipping major tag.");
    }
    else {    
      console.log(`Creating/updating release tag: ${ next.major } `);
      try {
        await octokit.git.deleteRef({
          ...context.repo,
          ref: `tags/${next.major}`
        });
      }
      catch {}
      await octokit.git.createRef({
        ...context.repo,
        ref: `refs/tags/${next.major}`,
        sha: context.sha
      });
    }
  }

  if(addMinorTag) {
    if(prerelease) {
      console.log("Release is a prerelease. Skipping minor tag.");
    }
    else {    
      console.log(`Creating/updating release tag: ${ next.minor } `);
      try {
        await octokit.git.deleteRef({
          ...context.repo,
          ref: `tags/${next.minor}`
        });
      }
      catch {}
      await octokit.git.createRef({
        ...context.repo,
        ref: `refs/tags/${next.minor}`,
        sha: context.sha
      });
    }
  }
}

run();
