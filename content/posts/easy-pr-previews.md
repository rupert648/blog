+++
title = "Your PR Previews Don't Need Vercel: My solution on a $5 VPS using Cloudflare and Github Actions"
date = "2024-12-30"

[taxonomies]
# todo: tags
tags = []

[extra]
repo_view = true
comment = true
+++
# DIY PR Preview Deployments: It's Easier Than You Think!

Let's preface this by admitting that the title is a little farcical - the fact that Vercel and other similar sites give you preview domains out of the box with no setup is a lovely feature. This blog is purely to show you that it's actually possible to configure these yourself, and furthermore, it's way easier than you might think!

To give you some context, my site [pert.dev](https://pert.dev) is built on [Zola](https://www.getzola.org/) - a static site which I serve on my $5 VPS from Linode, using [Caddy](https://caddyserver.com/). I use [Cloudflare](https://www.cloudflare.com/en-gb/) as my domain registrar and for DNS. While my setup (which I'll link to at the end if you want to skip ahead) is specific to these tools, my goal for this blog is to demonstrate that the core technologies for setting this up yourself are actually *easy-peasy*, regardless of your stack.

# PR-Previews: The Big Picture

At their heart, PR previews are surprisingly simple and can be broken down into three main components. We'll dive deep into each one, but here's the overview:

1. **DNS Management**: Creating a new A record for our preview subdomain
2. **File Deployment**: Getting our PR changes somewhere they can be served
3. **Web Server Config**: Telling our web server how to serve these files

The beauty is that these concepts apply whether you're running Next.js, Ruby on Rails, or a static site like mine.

# Initial Setup

First, let's create the files we'll need in our repository:

```bash
mkdir -p .github/workflows
touch .github/workflows/pr-preview.yml
```

We'll give this workflow some basic setup to run on PRs:

```yml
name: PR Preview

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  pull-requests: write

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Get PR number
        id: pr
        run: echo "PR_NUMBER=pr-${{ github.event.pull_request.number }}" >> $GITHUB_OUTPUT

      - name: Deploy Preview
        run: |
          chmod +x ./scripts/preview.sh
          ./scripts/preview.sh
```

I'm not going to deep-dive into GitHub Actions here, but we've added the essential steps: checkout the repo, grab the PR number (which we'll use later), and run our deployment script.

Next, let's create our script file:

```bash
mkdir scripts # if it doesn't exist already
touch scripts/preview.sh
chmod +x scripts/preview.sh
```

# Part 1: DNS Magic - Easier Than You Think

You don't need to be a DNS wizard to get this working, but if you're curious about the details, I'll point you to some great resources on [DNS basics](https://www.cloudflare.com/en-gb/learning/dns/what-is-dns/).

This part assumes two things:
* You own the domain and can update DNS records
* You have API access to your DNS provider (I'll show Cloudflare, but most providers have similar APIs)

PR previews typically use a subdomain pattern like `pr-123.yourdomain.com`. Creating this is surprisingly straightforward - we just need an A record pointing to our server's IP. If your site is already live, you probably have something like:

```
A record
yourdomain.com (or @)
253.253.253.253
```

For our preview, we'll create a similar record but with our PR subdomain. Here's how we do it via the Cloudflare API:

```bash
setup_dns() {
    local preview_id=$1
    local server_ip="253.253.253.253"
    
    # Check if record exists
    local existing_record=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records?name=${preview_id}.yourdomain.com" \
        -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
        -H "Content-Type: application/json")
    
    if echo "$existing_record" | grep -q "\"count\":0"; then
        # Create new record
        curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
            -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
            -H "Content-Type: application/json" \
            --data "{
                \"type\": \"A\",
                \"name\": \"${preview_id}\",
                \"content\": \"${server_ip}\",
                \"ttl\": 1,
                \"proxied\": true
            }"
    else
        # Update existing record
        local record_id=$(echo "$existing_record" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
        curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${record_id}" \
            -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
            -H "Content-Type: application/json" \
            --data "{
                \"type\": \"A\",
                \"name\": \"${preview_id}\",
                \"content\": \"${server_ip}\",
                \"ttl\": 1,
                \"proxied\": true
            }"
    fi
}
```

We'll need to pass some environment variables from our GitHub Actions:

```yml
      - name: Deploy Preview
        env:
          PREVIEW_ID: ${{ steps.pr.outputs.PR_NUMBER }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ZONE_ID: ${{ secrets.CLOUDFLARE_ZONE_ID }}
        run: |
          chmod +x ./scripts/preview.sh
          ./scripts/preview.sh
```

The Cloudflare [API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) and [Zone ID](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/) should be stored as GitHub secrets.

# Part 2: Deploying Your Changes

This part will vary depending on your stack, but the principle is the same: get your PR changes somewhere they can be served. I'll show you my Zola setup, but you can adapt this for any framework.

In my case, Zola builds a `/public` directory with all my static files. Your build process might look different:

```yml
      - name: Build site
        run: |
          # npm run build  # for Next.js/React
          # yarn build     # for Gatsby
          # bundle exec jekyll build  # for Jekyll
          zola build      # my case
```

Now we need to get these files to our server. Here's a simple but effective approach using nothing other than good old scp:

```bash
deploy_files() {
    local preview_id=$1
    
    # Ensure preview directory exists
    ssh "$USER@$HOST" "sudo mkdir -p /var/www/previews/${preview_id}"
    
    # Create temp directory for transfer
    ssh "$USER@$HOST" "mkdir -p /tmp/${preview_id}"
    
    # Copy built files
    scp -r public/* "$USER@$HOST:/tmp/${preview_id}/"
    
    # Move files to final location
    ssh "$USER@$HOST" "sudo rm -rf /var/www/previews/${preview_id}/* && \
                       sudo mv /tmp/${preview_id}/* /var/www/previews/${preview_id}/ && \
                       rm -rf /tmp/${preview_id}"
}
```

Add the SSH credentials to your GitHub Action:

```yml
      - name: Deploy Preview
        env:
          HOST: ${{ secrets.SERVER_HOST }}
          USER: ${{ secrets.SERVER_USER }}
          PREVIEW_ID: ${{ steps.pr.outputs.PR_NUMBER }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ZONE_ID: ${{ secrets.CLOUDFLARE_ZONE_ID }}
        run: |
          chmod +x ./scripts/preview.sh
          ./scripts/preview.sh
```

# Part 3: Web Server Configuration

The final piece is telling your web server about our new site. I'll show you how to do this with different servers:

First, create a directory for our preview configs:

```bash
# On your server
sudo mkdir -p /etc/caddy/conf.d  # for Caddy
# or
sudo mkdir -p /etc/nginx/sites-available  # for Nginx
```

**For Caddy** (my choice because it makes SSL super easy):
Add this to your main Caddyfile:
```Caddyfile
import /etc/caddy/conf.d/*
```

Then create preview configs like this:
```bash
setup_caddy() {
    local preview_id=$1
    local config_content="${preview_id}.yourdomain.com {
        root * /var/www/previews/${preview_id}
        file_server
    }"
    
    # Add/update site configuration
    echo "$config_content" | ssh "$USER@$HOST" "sudo tee /etc/caddy/conf.d/${preview_id}.conf"
    
    # Reload Caddy
    ssh "$USER@$HOST" "sudo systemctl reload caddy"
}
```

**For Nginx**:
```nginx
server {
    listen 80;
    server_name pr-123.yourdomain.com;
    root /var/www/previews/pr-123;
    
    location / {
        try_files $uri $uri/ =404;
    }
}
```

**For Apache**:
```apache
<VirtualHost *:80>
    ServerName pr-123.yourdomain.com
    DocumentRoot /var/www/previews/pr-123

    <Directory /var/www/previews/pr-123>
        Options Indexes FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>
</VirtualHost>
```

# Putting It All Together

Our complete `preview.sh` script looks like this:

```bash
#!/bin/bash

setup_dns() {
    # DNS setup function from above
}

deploy_files() {
    # File deployment function from above
}

setup_webserver() {
    # Web server config function from above
}

main() {
    setup_dns "$PREVIEW_ID"
    deploy_files "$PREVIEW_ID"
    setup_webserver "$PREVIEW_ID"
}

main
```

# Cleanup

One thing we haven't addressed is cleanup. When a PR is closed, we need to:
1. Remove the DNS record
2. Delete the preview files
3. Remove the web server config

Create a new GitHub workflow for this:

```yml
name: Cleanup PR Preview

on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Cleanup
        env:
          PREVIEW_ID: pr-${{ github.event.pull_request.number }}
          # Add other environment variables
        run: ./scripts/cleanup.sh
```

The complete cleanup scripts are available in my repo:
- [Cleanup Workflow](https://github.com/rupert648/pert.dev/blob/main/.github/workflows/cleanup-preview.yml)
- [Cleanup Script](https://github.com/rupert648/pert.dev/blob/main/scripts/cleanup-preview.sh)

# Conclusion

So there you have it! While fancy deployment platforms give you this for free, building your own preview system isn't as daunting as it might seem. With some basic systems knowledge and a few hours of work, you can have your own preview deployment system that:
- Costs nothing extra if you're already self-hosting
- Gives you complete control over the setup
- Helps you understand what's actually happening under the hood

Want to see the complete implementation? Check out:
- [PR Preview Workflow](https://github.com/rupert648/pert.dev/blob/main/.github/workflows/pr-preview.yml)
- [PR Preview Script](https://github.com/rupert648/pert.dev/blob/main/scripts/preview.sh)
- [Cleanup Workflow](https://github.com/rupert648/pert.dev/blob/main/.github/workflows/cleanup-preview.yml)
- [Cleanup Script](https://github.com/rupert648/pert.dev/blob/main/scripts/cleanup-preview.sh)
