Perform a release of the xlsxform package. Follow these steps in order:

## 1. Determine the previous release
- Run `git describe --tags --abbrev=0` to get the latest tag.
- If no tags exist, use the initial commit as the baseline.

## 2. Determine the new version
- Be sure we are in the `main` branch
- Review all commits since the last tag: `git log <previous-tag>..HEAD --oneline`
- If the user did not specify whether this is a patch, minor or major version, guess it based on the commit messages e.g. conventional commits, and the contents of the diff. Ask the user to confirm the new version before proceeding.

## 3. Update CHANGELOG.md
- Read the existing CHANGELOG.md (create it if it doesn't exist).
- Add a new section at the top (below any header) for the new version with today's date.
- Group changes by category: Features, Bug Fixes, Breaking Changes, Other.
- Use commit messages from `git log <previous-tag>..HEAD --pretty=format:"- %s (%h)"`.
- Write the updated CHANGELOG.md.

## 4. Bump version in package.json
- Update the `version` field in `xlsxform/package.json` to the new version.

## 5. Commit and tag
- Stage CHANGELOG.md and xlsxform/package.json.
- Commit with message: `chore: release v<version>`
- Create an annotated git tag: `git tag -a v<version> -m "v<version>"`

## 6. Push and create GitHub release
- Push the commit and tag: `git push && git push --tags`
- Create a GitHub release using `gh release create v<version> --title "v<version>" --notes-file -` with the changelog section for this version as the body.

## 7. Build and publish to npm
- Run `cd xlsxform && pnpm run build`
- Run `cd xlsxform && npm publish --access public`
- Verify the publish was successful.
