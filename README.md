# semver-tags

This action is designed to be used with CI/CD pipelines that automatically increment the version of the application.

## Inputs

### `GITHUB_TOKEN` **required** 
The github token.

### `tag-prefix`
A value prefixed to the version number when tagging the repo. 
#### Default value `''`

### `default-version`
The version number that will be used if no semver tag is found.
#### Default value `'1.0.0'`

### `incremented-value`
What value should be incremented. 
#### Allowed values `'major'|'minor'|'patch'` 
#### Default value `'patch'`

### `prerelease`
The prerelease tag that will be used in the semver version number.

### `metadata`
The metadata tag that will be used in the semver version number.

### `previous-major-version`
A value to use for the major version when searching for the previous version tag.

### `previous-minor-version`
A value to use for the minor version when searching for the previous version tag.

### `add-minor-tag`
Adds/updates a tag for the major.minor version.
#### Default value `false`

### `add-major-tag`
Adds/updates a tag for the major version.
#### Default value `false`

### `dry-run`
The prerelease tag that will be used in the semver version number.
#### Default value `false`

## Outputs

### `previous-version`
The previous version number.

### `core-version`
The core version part of the semantic version.

### `major-version`
The major version part of the semantic version.

### `minor-version`
The minor version part of the semantic version.

### `patch-version`
The patch version part of the semantic version.

### `semantic-version`
The calculated version number.

## Example usage
```yaml
uses: SOLIDSoftworks/semver-tags@v1
with:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN}}
  tag-prefix: 'v'
  default-version: '0.0.1'
  prerelease: 'alpha'
```
