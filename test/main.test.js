const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8');

async function runAction(inputs = {}, tags = []) {
  const values = {
    'default-version': '1.1.0',
    'incremented-value': 'patch',
    'create-release': 'false',
    'dry-run': 'true',
    ...inputs
  };
  const outputs = {};
  const refs = [];
  const releases = [];
  const exited = new Error('Action exited');
  const mocks = {
    '@actions/core': {
      getInput: name => values[name] || '',
      setOutput: (name, value) => { outputs[name] = String(value); }
    },
    '@actions/github': {
      context: { repo: { owner: 'example', repo: 'charts' }, sha: 'abc123' },
      getOctokit: () => ({
        repos: { listTags: async () => ({ status: 200, data: tags.map(name => ({ name })) }) },
        git: { createRef: async ref => { refs.push(ref); } },
        rest: { repos: { createRelease: async release => { releases.push(release); } } }
      })
    }
  };

  try {
    await vm.runInNewContext(source, {
      require: name => mocks[name] || require(name),
      console: { log() {}, debug() {} },
      process: {
        env: {},
        exit: code => {
          assert.equal(code, 0);
          throw exited;
        }
      }
    }, { filename: 'src/main.js' });
  }
  catch(error) {
    if(error !== exited) throw error;
  }

  return { outputs, refs, releases };
}

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

for(const prefix of ['', 'v', 'chart/', 'hatch-test-suite-v']) {
  test(`uses the plain default with no tags and prefix '${prefix}'`, async () => {
    const { outputs, refs, releases } = await runAction({ 'tag-prefix': prefix });
    assert.deepEqual(outputs, {
      'core-version': '1.1.0',
      'semantic-version': '1.1.0',
      'major-version': '1',
      'minor-version': '1',
      'patch-version': '0'
    });
    assert.equal(refs.length, 0);
    assert.equal(releases.length, 0);
  });
}

test('starts a new minor version when only older tags exist', async () => {
  const { outputs } = await runAction({
    'tag-prefix': 'chart/',
    'previous-major-version': '1',
    'previous-minor-version': '1'
  }, ['chart/1.0.30', 'chart/1.0.29', 'other/1.1.5']);
  assert.equal(outputs['semantic-version'], '1.1.0');
  assert.equal(outputs['previous-version'], undefined);
});

test('creates a tag with exactly one prefix', async () => {
  const { outputs, refs } = await runAction({ 'tag-prefix': 'chart/', 'dry-run': 'false' });
  assert.equal(outputs['semantic-version'], '1.1.0');
  assert.equal(refs.length, 1);
  assert.equal(refs[0].ref, 'refs/tags/chart/1.1.0');
});

test('creates a release with exactly one prefix', async () => {
  const { releases } = await runAction({
    'tag-prefix': 'chart/', 'dry-run': 'false', 'create-release': 'true'
  });
  assert.equal(releases.length, 1);
  assert.equal(releases[0].tag_name, 'chart/1.1.0');
});

for(const [increment, expected] of [['patch', '1.1.4'], ['minor', '1.2.0'], ['major', '2.0.0']]) {
  test(`increments the ${increment} of an existing prefixed tag`, async () => {
    const { outputs } = await runAction({
      'tag-prefix': 'chart/', 'incremented-value': increment
    }, ['chart/1.1.3']);
    assert.equal(outputs['semantic-version'], expected);
    assert.equal(outputs['previous-version'], 'chart/1.1.3');
  });
}

test('appends prerelease and metadata to the default version', async () => {
  const { outputs } = await runAction({
    'tag-prefix': 'chart/', prerelease: 'alpha.1', metadata: 'build.42'
  });
  assert.equal(outputs['core-version'], '1.1.0');
  assert.equal(outputs['semantic-version'], '1.1.0-alpha.1+build.42');
});

test('reports invalid defaults clearly', async () => {
  await assert.rejects(
    runAction({ 'tag-prefix': 'chart/', 'default-version': 'invalid' }),
    /Invalid default-version 'invalid'/
  );
});

test('rejects a prefixed default instead of duplicating the prefix', async () => {
  await assert.rejects(
    runAction({ 'tag-prefix': 'chart/', 'default-version': 'chart/1.1.0' }),
    /Invalid default-version 'chart\/1.1.0'/
  );
});

(async () => {
  let failures = 0;
  for(const { name, run } of tests) {
    try {
      await run();
      console.log(`PASS ${name}`);
    }
    catch(error) {
      failures++;
      console.error(`FAIL ${name}`, error);
    }
  }
  if(failures) process.exitCode = 1;
})();
