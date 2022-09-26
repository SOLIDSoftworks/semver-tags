const github = require('@actions/github');
const core = require('@actions/core');
const _ = require('lodash');

const nextVersion = function(semver, major, minor, patch) {
  this.semver = semver;
  this.major = major;
  this.minor = minor;
  this.patch = patch;
};

function generateVersionPattern(options) {
  console.log('Generating version regex pattern');

  let majorVersion = options.previousMajorVersion || '\\d+';
  let minorVersion = options.previousMinorVersion || '\\d+'
  let optional = '';
  if(!!options.tagPrefix && options.tagPrefixOptional) {
    optional = '?';
  }
  let pattern = `^${options.tagPrefix}${optional}(${majorVersion})\\.(${minorVersion})\\.(\\d+)(-(\\w[\\w\.]*))?(\\+(\\w[\\w\\.]*))?$`;
  console.log(`Generated pattern: ${pattern}`);
  return new RegExp(pattern, 'm');
}

async function calculateNextVersion(previous) {
  const defaultVersion = core.getInput('default-version');
  const incrementedValue = core.getInput('incremented-value');
  const prerelease = core.getInput('prerelease');
  const metadata = core.getInput('metadata');
  const tagPrefix = core.getInput('tag-prefix');
  const versionPattern = generateVersionPattern({ tagPrefix: tagPrefix, tagPrefixOptional: true });

  let semanticVersion = '';
  let major = '';
  let minor = '';
  let patch = '';

  if(!previous) {
    console.log(`No previous version tag. Using '${ defaultVersion }' as next version.`);
    let match = defaultVersion.match(versionPattern);
    major = match[1];
    minor = match[2];
    patch = match[3];
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
    semanticVersion += coreVersion;
  }

  console.log(`Core version: ${semanticVersion}`);
  core.setOutput('core-version', semanticVersion);

  if(prerelease) {
    console.log(`Prerelease configured. Adding '-${ prerelease }' to version number.`);
    semanticVersion += `-${prerelease}`;
  }
  if(metadata) {
    console.log(`Metadata configured. Adding '+${ metadata }' to version number.`);
    semanticVersion += `+${metadata}`;
  }
  console.log(`Semantic version: ${semanticVersion}`);
  core.setOutput('semantic-version', semanticVersion);
  console.log(`Major version: ${major}`);
  core.setOutput('major-version', major);
  console.log(`Minor version: ${minor}`);
  core.setOutput('minor-version', minor);
  console.log(`Patch version: ${patch}`);
  core.setOutput('patch-version', patch);
  return new nextVersion(semanticVersion, major, minor, patch);
}

async function run() {
  const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
  const dryRun = core.getInput('dry-run');
  const addMinorTag = !!core.getInput('add-minor-tag');
  const addMajorTag = !!core.getInput('add-major-tag');
  const prerelease = !!core.getInput('prerelease');
  const previousMajorVersion = core.getInput('previous-major-version');
  const previousMinorVersion = core.getInput('previous-minor-version');
  const tagPrefix = core.getInput('tag-prefix');
  const versionPattern = generateVersionPattern({ tagPrefix: tagPrefix, previousMajorVersion: previousMajorVersion, previousMinorVersion: previousMinorVersion });

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
  
  let tag = `${tagPrefix}${next.semver}`;
  console.log(`Creating new release tag: ${ tag } `);
  await octokit.rest.repos.createRelease({
    ...context.repo,
    tag_name: tag,
    prerelease: prerelease
  });

  if(addMajorTag) {
    if(prerelease) {
      console.log("Release is a prerelease. Skipping major tag.");
    }
    else {    
      tag = `${tagPrefix}${next.major}`;
      console.log(`Creating/updating release tag: ${tag} `);
      try {
        await octokit.git.deleteRef({
          ...context.repo,
          ref: `tags/${tag}`
        });
      }
      catch {}
      await octokit.git.createRef({
        ...context.repo,
        ref: `refs/tags/${tag}`,
        sha: context.sha
      });
    }
  }

  if(addMinorTag) {
    if(prerelease) {
      console.log("Release is a prerelease. Skipping minor tag.");
    }
    else {    
      tag = `${tagPrefix}${next.major}.${next.minor}`;
      console.log(`Creating/updating release tag: ${tag} `);
      try {
        await octokit.git.deleteRef({
          ...context.repo,
          ref: `tags/${tag}`
        });
      }
      catch {}
      await octokit.git.createRef({
        ...context.repo,
        ref: `refs/tags/${tag}`,
        sha: context.sha
      });
    }
  }
}

run();
