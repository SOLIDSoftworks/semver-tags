const { exec } = require('child_process');
const core = require('@actions/core');

function calculateNextVersion(previousVersion) {

}

exec('git fetch --tags', (err, stdout, stderr) => {
  const defaultVersion = core.getInput('default-version');
  
  if(err) {
    console.log('Unable to fetch tags');
    console.log(err);
    process.exit(1);
  }
  exec('git tag -l --sort=-v:refname', (err, stdout, stderr) => {
    let pattern = /^(\d+)\.(\d+)\.(\d+)(-\w[\w\.]*)?(\+\w[\w\.]*)?$/m;
    let previous = pattern.exec(stdout);
    let current = defaultVersion;
    if(previous) {
      console.log(`Found previous version tag '${previous}'. Calculating next version.`);
      current = calculateNextVersion(previous);
    }
    else {
      console.log(`Found no previous version tag. Using '${current}' as next version.`);
    }

    process.exit(0);
  })
});