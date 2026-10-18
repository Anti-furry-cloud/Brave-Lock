# Changelog

## 1.1.1

- Translate the popup, installer, errors, and documentation into English.
- Replace the popup layout with a compact view that follows the system color scheme.
- Add the Anti-furry-cloud credit to the popup, installer, README, and executable metadata.
- Add build instructions and portable tests for publishing the source.
- Report installer failures in the command window.
- Retry for about five seconds when another program, such as an antivirus scanner, still has the download open.
- Keep the `!` badge after a later successful rename. Opening the popup shows the error and clears the badge.
- Report "File not found." for missing files instead of a .NET exception message.
- Remove the generated host manifest on uninstall.

## 1.1.0

- Rename completed downloads through a local native messaging helper.
- Keep existing files when a target name is already taken.
- Show an error badge when renaming fails.

## 1.0.0

- Initial filename-suggestion extension. Chromium could replace the `.lock` suffix based on MIME type; superseded by 1.1.0.
