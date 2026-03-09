# Integration Settings Discovery

The CLI now has a powerful feature to discover what settings are available for each integration!

## New Command: `integrations:settings`

Get the settings schema, validation rules, and maximum character limits for any integration.

## Usage

```bash
trelexa integrations:settings <integration-id>
```

## What It Returns

```json
{
  "output": {
    "maxLength": 280,
    "settings": {
      "properties": {
        "who_can_reply_post": {
          "enum": ["everyone", "following", "mentionedUsers", "subscribers", "verified"],
          "description": "Who can reply to this post"
        },
        "community": {
          "pattern": "^(https://x.com/i/communities/\\d+)?$",
          "description": "X community URL"
        }
      },
      "required": ["who_can_reply_post"]
    }
  }
}
```

## Workflow

### 1. List Your Integrations

```bash
trelexa integrations:list
```

Output:
```json
[
  {
    "id": "reddit-abc123",
    "name": "My Reddit Account",
    "identifier": "reddit",
    "provider": "reddit"
  },
  {
    "id": "youtube-def456",
    "name": "My YouTube Channel",
    "identifier": "youtube",
    "provider": "youtube"
  },
  {
    "id": "twitter-ghi789",
    "name": "@myhandle",
    "identifier": "x",
    "provider": "x"
  }
]
```

### 2. Get Settings for Specific Integration

```bash
trelexa integrations:settings reddit-abc123
```

Output:
```json
{
  "output": {
    "maxLength": 40000,
    "settings": {
      "properties": {
        "subreddit": {
          "type": "array",
          "items": {
            "properties": {
              "value": {
                "properties": {
                  "subreddit": {
                    "type": "string",
                    "minLength": 2,
                    "description": "Subreddit name"
                  },
                  "title": {
                    "type": "string",
                    "minLength": 2,
                    "description": "Post title"
                  },
                  "type": {
                    "type": "string",
                    "description": "Post type (text or link)"
                  },
                  "url": {
                    "type": "string",
                    "description": "URL for link posts"
                  },
                  "is_flair_required": {
                    "type": "boolean",
                    "description": "Whether flair is required"
                  },
                  "flair": {
                    "properties": {
                      "id": "string",
                      "name": "string"
                    }
                  }
                },
                "required": ["subreddit", "title", "type", "is_flair_required"]
              }
            }
          }
        }
      },
      "required": ["subreddit"]
    }
  }
}
```

### 3. Use the Settings in Your Post

Now you know what settings are available and required!

```bash
trelexa posts:create \
  -c "My post content" \
  -p reddit \
  --settings '{
    "subreddit": [{
      "value": {
        "subreddit": "programming",
        "title": "Check this out!",
        "type": "text",
        "url": "",
        "is_flair_required": false
      }
    }]
  }' \
  -i "reddit-abc123"
```

## Examples by Platform

### Reddit

```bash
trelexa integrations:settings reddit-abc123
```

Returns:
- Max length: 40,000 characters
- Required settings: subreddit, title, type
- Optional: flair

### YouTube

```bash
trelexa integrations:settings youtube-def456
```

Returns:
- Max length: 5,000 characters (description)
- Required settings: title, type (public/private/unlisted)
- Optional: tags, thumbnail, selfDeclaredMadeForKids

### X (Twitter)

```bash
trelexa integrations:settings twitter-ghi789
```

Returns:
- Max length: 280 characters (or 4,000 for verified)
- Required settings: who_can_reply_post
- Optional: community

### LinkedIn

```bash
trelexa integrations:settings linkedin-jkl012
```

Returns:
- Max length: 3,000 characters
- Optional settings: post_as_images_carousel, carousel_name

### TikTok

```bash
trelexa integrations:settings tiktok-mno345
```

Returns:
- Max length: 150 characters (caption)
- Required settings: privacy_level, duet, stitch, comment, autoAddMusic, brand_content_toggle, brand_organic_toggle, content_posting_method
- Optional: title, video_made_with_ai

### Instagram

```bash
trelexa integrations:settings instagram-pqr678
```

Returns:
- Max length: 2,200 characters
- Required settings: post_type (post or story)
- Optional: is_trial_reel, graduation_strategy, collaborators

## No Additional Settings Required

Some platforms don't require specific settings:

```bash
trelexa integrations:settings threads-stu901
```

Returns:
```json
{
  "output": {
    "maxLength": 500,
    "settings": "No additional settings required"
  }
}
```

Platforms with no additional settings:
- Threads
- Mastodon
- Bluesky
- Telegram
- Nostr
- VK

## Use Cases

### 1. Discovery

Find out what settings are available before posting:

```bash
# What settings does YouTube support?
trelexa integrations:settings youtube-123

# What settings does Reddit support?
trelexa integrations:settings reddit-456
```

### 2. Validation

Check maximum character limits:

```bash
trelexa integrations:settings twitter-789 | jq '.output.maxLength'
# Output: 280
```

### 3. AI Agent Integration

AI agents can call this endpoint to:
- Discover available settings dynamically
- Validate settings before posting
- Adapt to platform-specific requirements

```javascript
// Get settings schema
const settings = await execSync(
  `trelexa integrations:settings ${integrationId}`,
  { encoding: 'utf-8' }
);
const schema = JSON.parse(settings);

// Check max length
if (content.length > schema.output.maxLength) {
  content = content.substring(0, schema.output.maxLength);
}

// Use required settings
const requiredSettings = schema.output.settings.required || [];
```

### 4. Form Generation

Use the schema to generate UI forms:

```javascript
const settings = await getIntegrationSettings('reddit-123');
const schema = settings.output.settings;

// Generate form fields from schema
schema.properties.subreddit.items.properties.value.properties
// → subreddit (text, minLength: 2)
// → title (text, minLength: 2)
// → type (select: text/link)
// → etc.
```

## Combined Workflow

Complete workflow for posting with correct settings:

```bash
#!/bin/bash
export TRELEXA_API_KEY=your_key

# 1. List integrations
echo "📋 Available integrations:"
trelexa integrations:list

# 2. Get settings for Reddit
echo ""
echo "⚙️  Reddit settings:"
SETTINGS=$(trelexa integrations:settings reddit-123)
echo $SETTINGS | jq '.output.maxLength'
echo $SETTINGS | jq '.output.settings'

# 3. Create post with correct settings
echo ""
echo "📝 Creating post..."
trelexa posts:create \
  -c "My post content" \
  -p reddit \
  --settings '{
    "subreddit": [{
      "value": {
        "subreddit": "programming",
        "title": "Interesting post",
        "type": "text",
        "url": "",
        "is_flair_required": false
      }
    }]
  }' \
  -i "reddit-123"
```

## API Endpoint

The command calls:
```
GET /public/v1/integration-settings/:id
```

Returns:
```typescript
{
  output: {
    maxLength: number;
    settings: ValidationSchema | "No additional settings required";
  }
}
```

## Error Handling

### Integration Not Found

```bash
trelexa integrations:settings invalid-id
# ❌ Failed to get integration settings: Integration not found
```

### API Key Not Set

```bash
trelexa integrations:settings reddit-123
# ❌ Error: TRELEXA_API_KEY environment variable is required
```

## Tips

1. **Always check settings first** before creating posts with custom settings
2. **Use the schema** to validate your settings object
3. **Check maxLength** to avoid exceeding character limits
4. **For AI agents**: Cache the settings to avoid repeated API calls
5. **Required fields** must be included in your settings object

## Comparison: Before vs After

### Before ❌

```bash
# Had to guess what settings are available
# Had to read documentation or source code
# Didn't know character limits
```

### After ✅

```bash
# Discover settings programmatically
trelexa integrations:settings reddit-123

# See exactly what's required and optional
# Know the exact character limits
# Get validation schemas
```

## Summary

✅ **Discover settings for any integration**
✅ **Get character limits**
✅ **See validation schemas**
✅ **Know required vs optional fields**
✅ **Perfect for AI agents**
✅ **No more guesswork!**

**Now you can discover what settings each platform supports!** 🎉
