#!/bin/sh
DOCUMENT_ROOT=/var/www/sources

# Take site offline
echo "Taking site offline..."
touch $DOCUMENT_ROOT/maintenance.file

# Swap over the content
echo "Deploying content..."
mkdir -p $DOCUMENT_ROOT/ApplePodcasts
cp ApplePodcastsIcon.png $DOCUMENT_ROOT/ApplePodcasts
cp ApplePodcastsConfig.json $DOCUMENT_ROOT/ApplePodcasts
cp ApplePodcastsScript.js $DOCUMENT_ROOT/ApplePodcasts
sh sign.sh $DOCUMENT_ROOT/ApplePodcasts/ApplePodcastsScript.js $DOCUMENT_ROOT/ApplePodcasts/ApplePodcastsConfig.json

# Notify Cloudflare to wipe the CDN cache
echo "Purging Cloudflare cache for zone $CLOUDFLARE_ZONE_ID..."
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"files":["https://plugins.grayjay.app/ApplePodcasts/ApplePodcastsIcon.png", "https://plugins.grayjay.app/ApplePodcasts/ApplePodcastsConfig.json", "https://plugins.grayjay.app/ApplePodcasts/ApplePodcastsScript.js"]}'

# Take site back online
echo "Bringing site back online..."
rm $DOCUMENT_ROOT/maintenance.file
