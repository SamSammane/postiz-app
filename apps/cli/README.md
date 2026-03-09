# Trelexa CLI

**Social media automation CLI for AI agents** - Schedule posts across 28+ platforms programmatically.

The Trelexa CLI provides a command-line interface to the Trelexa.ai API, enabling developers and AI agents to automate social media posting, manage content, and handle media uploads across platforms like Twitter/X, LinkedIn, Reddit, YouTube, TikTok, Instagram, Facebook, and more.

---

## Installation

### From npm (Recommended)

```bash
npm install -g trelexa
# or
pnpm install -g trelexa
```

### From Source

```bash
git clone https://github.com/SamSammane/postiz-app.git
cd postiz-app/apps/cli
pnpm install
pnpm run build
pnpm link --global
```

### For Development

```bash
cd apps/cli
pnpm install
pnpm run build
pnpm link --global

# Or run directly without linking
pnpm run start -- posts:list
```

---

## Setup

**Required:** Set your Trelexa.ai API key

```bash
export TRELEXA_API_KEY=your_api_key_here
```

**Optional:** Custom API endpoint

```bash
export TRELEXA_API_URL=https://your-custom-api.com
```

---

## Commands

### Discovery & Settings

**List all connected integrations**
```bash
trelexa integrations:list
```

Returns integration IDs, provider names, and metadata.

**Get integration settings schema**
```bash
trelexa integrations:settings <integration-id>
```

Returns character limits, required settings, and available tools for fetching dynamic data.

**Trigger integration tools**
```bash
trelexa integrations:trigger <integration-id> <method-name>
trelexa integrations:trigger <integration-id> <method-name> -d '{"key":"value"}'
```

Fetch dynamic data like Reddit flairs, YouTube playlists, LinkedIn companies, etc.

**Examples:**
```bash
# Get Reddit flairs
trelexa integrations:trigger reddit-123 getFlairs -d '{"subreddit":"programming"}'

# Get YouTube playlists
trelexa integrations:trigger youtube-456 getPlaylists

# Get LinkedIn companies
trelexa integrations:trigger linkedin-789 getCompanies
```

---

### Creating Posts

**Simple scheduled post**
```bash
trelexa posts:create -c "Content" -s "2024-12-31T12:00:00Z" -i "integration-id"
```

**Draft post**
```bash
trelexa posts:create -c "Content" -s "2024-12-31T12:00:00Z" -t draft -i "integration-id"
```

**Post with media**
```bash
trelexa posts:create -c "Content" -m "img1.jpg,img2.jpg" -s "2024-12-31T12:00:00Z" -i "integration-id"
```

**Post with comments** (each comment can have its own media)
```bash
trelexa posts:create \
  -c "Main post" -m "main.jpg" \
  -c "First comment" -m "comment1.jpg" \
  -c "Second comment" -m "comment2.jpg,comment3.jpg" \
  -s "2024-12-31T12:00:00Z" \
  -i "integration-id"
```

**Multi-platform post**
```bash
trelexa posts:create -c "Content" -s "2024-12-31T12:00:00Z" -i "twitter-id,linkedin-id,facebook-id"
```

**Platform-specific settings**
```bash
trelexa posts:create \
  -c "Content" \
  -s "2024-12-31T12:00:00Z" \
  --settings '{"subreddit":[{"value":{"subreddit":"programming","title":"Post Title","type":"text"}}]}' \
  -i "reddit-id"
```

**Complex post from JSON file**
```bash
trelexa posts:create --json post.json
```

**Options:**
- `-c, --content` - Post/comment content (use multiple times for posts with comments)
- `-s, --date` - Schedule date in ISO 8601 format (REQUIRED)
- `-t, --type` - Post type: "schedule" or "draft" (default: "schedule")
- `-m, --media` - Comma-separated media URLs for corresponding `-c`
- `-i, --integrations` - Comma-separated integration IDs (required)
- `-d, --delay` - Delay between comments in milliseconds (default: 5000)
- `--settings` - Platform-specific settings as JSON string
- `-j, --json` - Path to JSON file with full post structure
- `--shortLink` - Use short links (default: true)

---

### Managing Posts

**List posts**
```bash
trelexa posts:list
trelexa posts:list --startDate "2024-01-01T00:00:00Z" --endDate "2024-12-31T23:59:59Z"
trelexa posts:list --customer "customer-id"
```

Defaults to last 30 days to next 30 days if dates not specified.

**Delete post**
```bash
trelexa posts:delete <post-id>
```

---

### Media Upload

**Upload file and get URL**
```bash
trelexa upload <file-path>
```

**⚠️ IMPORTANT: Upload Files Before Posting**

You **must** upload media files to Trelexa.ai before using them in posts. Many platforms (especially TikTok, Instagram, and YouTube) require verified/trusted URLs and will reject external links.

**Workflow:**
1. Upload your file using `trelexa upload`
2. Extract the returned URL
3. Use that URL in your post's `-m` parameter

**Supported formats:**
- **Images:** PNG, JPG, JPEG, GIF, WEBP, SVG, BMP, ICO
- **Videos:** MP4, MOV, AVI, MKV, WEBM, FLV, WMV, M4V, MPEG, MPG, 3GP
- **Audio:** MP3, WAV, OGG, AAC, FLAC, M4A
- **Documents:** PDF, DOC, DOCX

**Example:**
```bash
# 1. Upload the file first
RESULT=$(trelexa upload video.mp4)
PATH=$(echo "$RESULT" | jq -r '.path')

# 2. Use the Trelexa.ai URL in your post
trelexa posts:create -c "Check out my video!" -s "2024-12-31T12:00:00Z" -m "$PATH" -i "tiktok-id"
```

**Why this is required:**
- **TikTok, Instagram, YouTube** only accept URLs from trusted domains
- **Security:** Platforms verify media sources to prevent abuse
- **Reliability:** Trelexa.ai ensures your media is always accessible

---

## Platform-Specific Features

### Reddit
```bash
# Get available flairs
trelexa integrations:trigger reddit-id getFlairs -d '{"subreddit":"programming"}'

# Post with subreddit and flair
trelexa posts:create \
  -c "Content" \
  -s "2024-12-31T12:00:00Z" \
  --settings '{"subreddit":[{"value":{"subreddit":"programming","title":"My Post","type":"text","is_flair_required":true,"flair":{"id":"flair-123","name":"Discussion"}}}]}' \
  -i "reddit-id"
```

### YouTube
```bash
# Get playlists
trelexa integrations:trigger youtube-id getPlaylists

# Upload video FIRST (required!)
VIDEO=$(trelexa upload video.mp4)
VIDEO_URL=$(echo "$VIDEO" | jq -r '.path')

# Post with uploaded video URL
trelexa posts:create \
  -c "Video description" \
  -s "2024-12-31T12:00:00Z" \
  --settings '{"title":"Video Title","type":"public","tags":[{"value":"tech","label":"Tech"}],"playlistId":"playlist-id"}' \
  -m "$VIDEO_URL" \
  -i "youtube-id"
```

### TikTok
```bash
# Upload video FIRST (TikTok only accepts verified URLs!)
VIDEO=$(trelexa upload video.mp4)
VIDEO_URL=$(echo "$VIDEO" | jq -r '.path')

# Post with uploaded video URL
trelexa posts:create \
  -c "Video caption #fyp" \
  -s "2024-12-31T12:00:00Z" \
  --settings '{"privacy":"PUBLIC_TO_EVERYONE","duet":true,"stitch":true}' \
  -m "$VIDEO_URL" \
  -i "tiktok-id"
```

### LinkedIn
```bash
# Get companies you can post to
trelexa integrations:trigger linkedin-id getCompanies

# Post as company
trelexa posts:create \
  -c "Company announcement" \
  -s "2024-12-31T12:00:00Z" \
  --settings '{"companyId":"company-123"}' \
  -i "linkedin-id"
```

### X (Twitter)
```bash
# Create thread
trelexa posts:create \
  -c "Thread 1/3 🧵" \
  -c "Thread 2/3" \
  -c "Thread 3/3" \
  -s "2024-12-31T12:00:00Z" \
  -d 2000 \
  -i "twitter-id"

# With reply settings
trelexa posts:create \
  -c "Tweet content" \
  -s "2024-12-31T12:00:00Z" \
  --settings '{"who_can_reply_post":"everyone"}' \
  -i "twitter-id"
```

### Instagram
```bash
# Upload image FIRST (Instagram requires verified URLs!)
IMAGE=$(trelexa upload image.jpg)
IMAGE_URL=$(echo "$IMAGE" | jq -r '.path')

# Regular post
trelexa posts:create \
  -c "Caption #hashtag" \
  -s "2024-12-31T12:00:00Z" \
  --settings '{"post_type":"post"}' \
  -m "$IMAGE_URL" \
  -i "instagram-id"

# Story (upload first)
STORY=$(trelexa upload story.jpg)
STORY_URL=$(echo "$STORY" | jq -r '.path')

trelexa posts:create \
  -c "" \
  -s "2024-12-31T12:00:00Z" \
  --settings '{"post_type":"story"}' \
  -m "$STORY_URL" \
  -i "instagram-id"
```

**See [PROVIDER_SETTINGS.md](./PROVIDER_SETTINGS.md) for all 28+ platforms.**

---

## Features for AI Agents

### Discovery Workflow
The CLI enables dynamic discovery of integration capabilities:

1. **List integrations** - Get available social media accounts
2. **Get settings** - Retrieve character limits, required fields, and available tools
3. **Trigger tools** - Fetch dynamic data (flairs, playlists, boards, etc.)
4. **Create posts** - Use discovered data in posts

This allows AI agents to adapt to different platforms without hardcoded knowledge.

### JSON Mode
For complex posts with multiple platforms and settings:

```bash
trelexa posts:create --json complex-post.json
```

JSON structure:
```json
{
  "integrations": ["twitter-123", "linkedin-456"],
  "posts": [
    {
      "provider": "twitter",
      "post": [
        {
          "content": "Tweet version",
          "image": ["twitter-image.jpg"]
        }
      ]
    },
    {
      "provider": "linkedin",
      "post": [
        {
          "content": "LinkedIn version with more context...",
          "image": ["linkedin-image.jpg"]
        }
      ],
      "settings": {
        "__type": "linkedin",
        "companyId": "company-123"
      }
    }
  ]
}
```

### All Output is JSON
Every command outputs JSON for easy parsing:

```bash
INTEGRATIONS=$(trelexa integrations:list | jq -r '.')
REDDIT_ID=$(echo "$INTEGRATIONS" | jq -r '.[] | select(.identifier=="reddit") | .id')
```

### Threading Support
Comments are automatically converted to threads/replies based on platform:
- **Twitter/X**: Thread of tweets
- **Reddit**: Comment replies
- **LinkedIn**: Comment on post
- **Instagram**: First comment

```bash
trelexa posts:create \
  -c "Main post" \
  -c "Comment 1" \
  -c "Comment 2" \
  -i "integration-id"
```

---

## Common Workflows

### Reddit Post with Flair
```bash
#!/bin/bash
REDDIT_ID=$(trelexa integrations:list | jq -r '.[] | select(.identifier=="reddit") | .id')
FLAIRS=$(trelexa integrations:trigger "$REDDIT_ID" getFlairs -d '{"subreddit":"programming"}')
FLAIR_ID=$(echo "$FLAIRS" | jq -r '.output[0].id')

trelexa posts:create \
  -c "My post content" \
  -s "2024-12-31T12:00:00Z" \
  --settings "{\"subreddit\":[{\"value\":{\"subreddit\":\"programming\",\"title\":\"Post Title\",\"type\":\"text\",\"is_flair_required\":true,\"flair\":{\"id\":\"$FLAIR_ID\",\"name\":\"Discussion\"}}}]}" \
  -i "$REDDIT_ID"
```

### YouTube Video Upload
```bash
#!/bin/bash
VIDEO=$(trelexa upload video.mp4)
VIDEO_PATH=$(echo "$VIDEO" | jq -r '.path')

trelexa posts:create \
  -c "Video description..." \
  -s "2024-12-31T12:00:00Z" \
  --settings '{"title":"My Video","type":"public","tags":[{"value":"tech","label":"Tech"}]}' \
  -m "$VIDEO_PATH" \
  -i "youtube-id"
```

### Multi-Platform Campaign
```bash
#!/bin/bash
trelexa posts:create \
  -c "Same content everywhere" \
  -s "2024-12-31T12:00:00Z" \
  -m "image.jpg" \
  -i "twitter-id,linkedin-id,facebook-id"
```

### Batch Scheduling
```bash
#!/bin/bash
DATES=("2024-02-14T09:00:00Z" "2024-02-15T09:00:00Z" "2024-02-16T09:00:00Z")
CONTENT=("Monday motivation 💪" "Tuesday tips 💡" "Wednesday wisdom 🧠")

for i in "${!DATES[@]}"; do
  trelexa posts:create \
    -c "${CONTENT[$i]}" \
    -s "${DATES[$i]}" \
    -i "twitter-id"
done
```

---

## Documentation

**For AI Agents:**
- **[SKILL.md](./SKILL.md)** - Complete skill reference with patterns and examples

**Deep-Dive Guides:**
- **[HOW_TO_RUN.md](./HOW_TO_RUN.md)** - Installation and setup methods
- **[COMMAND_LINE_GUIDE.md](./COMMAND_LINE_GUIDE.md)** - Complete command syntax reference
- **[PROVIDER_SETTINGS.md](./PROVIDER_SETTINGS.md)** - All platform settings schemas
- **[INTEGRATION_TOOLS_WORKFLOW.md](./INTEGRATION_TOOLS_WORKFLOW.md)** - Tools workflow guide
- **[INTEGRATION_SETTINGS_DISCOVERY.md](./INTEGRATION_SETTINGS_DISCOVERY.md)** - Settings discovery
- **[SUPPORTED_FILE_TYPES.md](./SUPPORTED_FILE_TYPES.md)** - Media format reference
- **[PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md)** - Code architecture
- **[PUBLISHING.md](./PUBLISHING.md)** - npm publishing guide

**Examples:**
- **[examples/EXAMPLES.md](./examples/EXAMPLES.md)** - Comprehensive examples
- **[examples/](./examples/)** - Ready-to-use scripts and JSON files

---

## API Endpoints

The CLI interacts with these Trelexa.ai API endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/public/v1/posts` | POST | Create a post |
| `/public/v1/posts` | GET | List posts |
| `/public/v1/posts/:id` | DELETE | Delete a post |
| `/public/v1/integrations` | GET | List integrations |
| `/public/v1/integration-settings/:id` | GET | Get integration settings |
| `/public/v1/integration-trigger/:id` | POST | Trigger integration tool |
| `/public/v1/upload` | POST | Upload media |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TRELEXA_API_KEY` | ✅ Yes | - | Your Trelexa.ai API key |
| `TRELEXA_API_URL` | No | `http://localhost:3000` | Custom API endpoint |

---

## Error Handling

The CLI provides clear error messages with exit codes:

- **Exit code 0**: Success
- **Exit code 1**: Error occurred

**Common errors:**

| Error | Solution |
|-------|----------|
| `TRELEXA_API_KEY is not set` | Set environment variable: `export TRELEXA_API_KEY=key` |
| `Integration not found` | Run `integrations:list` to get valid IDs |
| `startDate/endDate required` | Use ISO 8601 format: `"2024-12-31T12:00:00Z"` |
| `Invalid settings` | Check `integrations:settings` for required fields |
| `Tool not found` | Check available tools in `integrations:settings` output |
| `Upload failed` | Verify file exists and format is supported |

---

## Development

### Project Structure

```
apps/cli/
├── src/
│   ├── index.ts              # CLI entry point with yargs
│   ├── api.ts                # TrelexaAPI client class
│   ├── config.ts             # Environment configuration
│   └── commands/
│       ├── posts.ts          # Post management commands
│       ├── integrations.ts   # Integration commands
│       └── upload.ts         # Media upload command
├── examples/                 # Example scripts and JSON files
├── package.json
├── tsconfig.json
├── tsup.config.ts            # Build configuration
├── README.md                 # This file
└── SKILL.md                  # AI agent reference
```

### Scripts

```bash
pnpm run dev       # Watch mode for development
pnpm run build     # Build the CLI
pnpm run start     # Run the built CLI
```

### Building

The CLI uses `tsup` for bundling:

```bash
pnpm run build
```

Output in `dist/`:
- `index.js` - Bundled executable with shebang
- `index.js.map` - Source map

---

## Quick Reference

```bash
# Environment setup
export TRELEXA_API_KEY=your_key

# Discovery
trelexa integrations:list                           # List integrations
trelexa integrations:settings <id>                  # Get settings
trelexa integrations:trigger <id> <method> -d '{}'  # Fetch data

# Posting (date is required)
trelexa posts:create -c "text" -s "2024-12-31T12:00:00Z" -i "id"                    # Simple
trelexa posts:create -c "text" -s "2024-12-31T12:00:00Z" -t draft -i "id"          # Draft
trelexa posts:create -c "text" -m "img.jpg" -s "2024-12-31T12:00:00Z" -i "id"      # With media
trelexa posts:create -c "main" -c "comment" -s "2024-12-31T12:00:00Z" -i "id"      # With comment
trelexa posts:create -c "text" -s "2024-12-31T12:00:00Z" --settings '{}' -i "id"   # Platform-specific
trelexa posts:create --json file.json                                               # Complex

# Management
trelexa posts:list                                  # List posts
trelexa posts:delete <id>                          # Delete post
trelexa upload <file>                              # Upload media

# Help
trelexa --help                                     # Show help
trelexa posts:create --help                        # Command help
```

---

## Contributing

This CLI is part of the [Trelexa.ai monorepo](https://github.com/SamSammane/postiz-app).

To contribute:
1. Fork the repository
2. Create a feature branch
3. Make your changes in `apps/cli/`
4. Run tests: `pnpm run build`
5. Submit a pull request

---

## License

AGPL-3.0

---

## Links

- **Website:** [trelexa.ai](https://trelexa.ai)
- **API Docs:** [trelexa.ai/api-docs](https://trelexa.ai/api-docs)
- **GitHub:** [SamSammane/postiz-app](https://github.com/SamSammane/postiz-app)
- **Issues:** [Report bugs](https://github.com/SamSammane/postiz-app/issues)

---

## Supported Platforms

28+ platforms including:

| Platform | Integration Tools | Settings |
|----------|------------------|----------|
| Twitter/X | getLists, getCommunities | who_can_reply_post |
| LinkedIn | getCompanies | companyId, carousel |
| Reddit | getFlairs, searchSubreddits | subreddit, title, flair |
| YouTube | getPlaylists, getCategories | title, type, tags, playlistId |
| TikTok | - | privacy, duet, stitch |
| Instagram | - | post_type (post/story) |
| Facebook | getPages | - |
| Pinterest | getBoards, getBoardSections | - |
| Discord | getChannels | - |
| Slack | getChannels | - |
| And 18+ more... | | |

**See [PROVIDER_SETTINGS.md](./PROVIDER_SETTINGS.md) for complete documentation.**
