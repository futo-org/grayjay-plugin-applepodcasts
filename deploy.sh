#!/bin/sh
DOCUMENT_ROOT=/var/www/sources

# Use environment variable to determine deployment type
PRE_RELEASE=${PRE_RELEASE:-false}  # Default to false if not set

# Determine deployment directory
if [ "$PRE_RELEASE" = "true" ]; then
    RELATIVE_PATH="pre-release/ApplePodcasts"
else
    RELATIVE_PATH="ApplePodcasts"
fi

DEPLOY_DIR="$DOCUMENT_ROOT/$RELATIVE_PATH"
PLUGIN_URL_ROOT="https://plugins.grayjay.app/$RELATIVE_PATH"
SOURCE_URL="$PLUGIN_URL_ROOT/ApplePodcastsConfig.json"


# Take site offline
echo "Taking site offline..."
touch $DOCUMENT_ROOT/maintenance.file

# Swap over the content
echo "Deploying content..."
mkdir -p "$DEPLOY_DIR"
cp ApplePodcastsIcon.png "$DEPLOY_DIR"
cp ApplePodcastsConfig.json "$DEPLOY_DIR"
cp ApplePodcastsScript.js "$DEPLOY_DIR"

# Update the sourceUrl in ApplePodcastsConfig.json
echo "Updating sourceUrl in ApplePodcastsConfig.json..."
jq --arg sourceUrl "$SOURCE_URL" '.sourceUrl = $sourceUrl' "$DEPLOY_DIR/ApplePodcastsConfig.json" > "$DEPLOY_DIR/ApplePodcastsConfig_temp.json"
if [ $? -eq 0 ]; then
    mv "$DEPLOY_DIR/ApplePodcastsConfig_temp.json" "$DEPLOY_DIR/ApplePodcastsConfig.json"
else
    echo "Failed to update ApplePodcastsConfig.json" >&2
    exit 1
fi

sh sign.sh "$DEPLOY_DIR/ApplePodcastsScript.js" "$DEPLOY_DIR/ApplePodcastsConfig.json"

# Notify Cloudflare to wipe the CDN cache
echo "Purging Cloudflare cache for zone $CLOUDFLARE_ZONE_ID..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"files":["'"$PLUGIN_URL_ROOT/ApplePodcastsIcon.png"'", "'"$PLUGIN_URL_ROOT/ApplePodcastsConfig.json"'", "'"$PLUGIN_URL_ROOT/ApplePodcastsScript.js"'"]}'

# Take site back online
echo "Bringing site back online..."
rm "$DOCUMENT_ROOT/maintenance.file"
