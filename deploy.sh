#!/bin/sh
set -eu

PRE_RELEASE=${PRE_RELEASE:-false}  # Default to false if not set

# Determine deployment directory
if [ "$PRE_RELEASE" = "true" ]; then
    RELATIVE_PATH="unstable/ApplePodcasts"
else
    RELATIVE_PATH="ApplePodcasts"
fi

sh "$(dirname "$0")/publish-r2.sh" "$RELATIVE_PATH" ApplePodcastsConfig.json ApplePodcastsConfig.json ApplePodcastsScript.js ApplePodcastsIcon.png
