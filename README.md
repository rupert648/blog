# My Website!
[![Netlify Status](https://api.netlify.com/api/v1/badges/3abea8c3-8ae2-46fc-aaea-3214fb75080d/deploy-status)](https://app.netlify.com/sites/lively-jelly-96461b/deploys)

Blog and Portfolio site where I can showcase projects and write articles about anything I want! 
This website is built using [Docusaurus 2](https://docusaurus.io/), a static site generator created at Meta, allowing me to easily deploy new content to my site through easy use of markdown files.

### Installation

```
$ yarn
```

### Local Development

```
$ yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

### Build

```
$ yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.


Using SSH:

```
$ USE_SSH=true yarn deploy
```

Not using SSH:

```
$ GIT_USER=<Your GitHub username> yarn deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.
