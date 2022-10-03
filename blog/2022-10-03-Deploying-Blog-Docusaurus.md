---
slug: Creating and Deploying a Personal Blog/Portfolio using Docusaurus
title: Creating and Deploying a Personal Blog/Portfolio using Docusaurus
authors: [rupert]
tags: [Software, Docusaurus, blog, self-hosted]
---

Docusaurus is the solution from meta for building content based static html sites using nothing more than markdown files. Despite designed around the use-case of building documentation, at its heart Docusaurus is a easy to use content management system, and with its already inbuilt blog feature set it is the perfect candidate to quickly and easily setup a personal website and blog.

Setup
=====

Setup is as simple as following the [docusarus setup documentation](https://docusaurus.io/docs/installation), and it is quickest to start out with their scaffold project website from which we can expand and adjust. Their documentation, as you would expect from a documentation tool, is fantastic. I strongly suggest opening another tab and browsing this in addition to going through this article, however to save you time I will demonstrate the steps for setting up below.

First, create the scaffold project website using **npx.** We’ll be adding the `--typescript` tag to create a typescript project, but this isn’t necessary.

```
npx create-docusaurus@latest my-website classic --typescript
```

And marvellously thats it! You now have a full website, congrats! This generates a folder titled `my-website` containing the following file structure (truncated below in some places for size on page)

```
my-website  
├── blog  
│   ├── 2021-08-26-welcome.md  
│   ├── 2019-05-28-first-blog-post.md  
│   └── 2019-05-29-long-blog-post.md  
│   └── 2019-08-01-mdx-blog-post.mdx  
│   └── authors.yml  
├── docs  
│   ├── tutorial-basics  
│   │   └── congratulations.md  
│   │   └── create-a-blog-post.md  
│   │   └── create-a-document.md  
│   │   └── create-a-page.md  
│   │   └── deploy-your-site.md  
│   │   └── markdown-features.md  
│   │   └── \_category\_.json  
│   ├── tutorial-extras  
│   ├── intro.md  
├── src  
│   ├── components  
│   │   └── HomePageFeatures  
│   ├── css  
│   │   └── custom.css  
│   └── pages  
│       ├── index.module.css  
│       └── index.tsx  
│       └── markdown-page.md  
├── static  
│   └── img  
├── docusaurus.config.js  
├── tsconfig.json  
├── .gitignore  
├── babel.config.js  
├── package.json  
├── README.md  
├── sidebars.js  
└── package-lock.json
```

of key note here are the `docs` and `blog` directories, as well as the `docusaurus.config.js` file, in which most of the heavy lifting for converting this into our perfect blog site is done.

**Running the Development Server**
==================================

Running the following will launch a local development server where you can see your new website!

```
npm start
```

This will default to `[http://localhost:3000](http://localhost:3000)` which you can open in your browser to see. We can see through doing this that a lot of unneccessary docusaurus boilerplate has been included.

Modifying to suit our needs
===========================

The first thing I wanted to do was to sort out our directory structure. First of all, `docs` doesn’t really make a lot of sense in our context. Docusaurus unsurprisingly requires this, so the best move is to re-purpose it. Instead I wanted this section to become the “Portfolio” section of our site — it makes sense given that your projects **_should be documented_** 😉. To do this we need to make the following adjustments.

First of all lets rename our `docs` folder to something more suitable. Since [version 2.0](https://docusaurus.io/docs/migration/manual#customdocspath-docsurl-editurl-enableupdateby-enableupdatetime) this is extremely simple. We make the following changes in `docusaurus.config.js`

`routeBasePath` changes the routing on the site, meaning if you have some documentation titled `myProject` the route will now be `/portfolio/myProject` rather than `/docs/myProject` .

`path` changes where docusaurus searches your project for ‘doc’ markdown files, which it uses to generate the portfolio section.

Now **to match this change we must rename our** `**docs**` **folder to** `**portfolio**`

Please note that you can call ‘portfolio’ whatever you want!

Adding Projects
===============

Now create markdown files within your new folder to populate your site with your projects! Each project can have nested pages by creating sub-folders in the `portfolio` folder. See the [docusaurus documentation](https://docusaurus.io/docs/docs-introduction) for more information about this.

Blog
====

One of the main reasons I decided to create a personal site was to host my own blog. A reason docusaurus became my choice for this was due to its out of the box blog support. This supports many features which can enhance your blog — making it much more enjoyable to interact with than simply text. For example tags and reading time.

Adding a blog to your site is extremely easy — simply add a folder to your root titled `blog` , this is already done for you in the generated file structure. Then, to create a blog, create a file titled `{year}-{month}-{day}-{title}.md` . Docusaurus also provides the functionality to provide multiple authors, tags and many other features, all of which can be found [in their documentation](https://docusaurus.io/docs/blog).

And thats mostly it for the content side of things, once again the docusaurus documentation is unsurprisingly fantastic and completely comprehensive, and will give you access to many other features such as custom pages, themeing and lots else.

Deploying the Site
==================

Docusaurus is a _static site generator._ Meaning it generates static files which can simply be served from your favourite static site hosting service. For example, you could simply dump the files inside the build directory into an S3 bucket which would work absolutely fine.

Sites like [Netlify](https://www.netlify.com) offer a great free tier which gives you pretty much everything you would want for a small blog site. They can also deploy directly from a github repo meaning you can version control your sites content. Simply connect your netlify project to your docusaurus sites github repo, then specify `npm run build` as the build command and `build` as the publish directory. This is exactly what I did and it was super simple! Netlify (even on the free tier!) also allows you to connect your own domains. View [rupertcarr.uk](https://rupertcarr.uk) to see mine!

Summing Up
==========

To wrap up — is docusaurus the optimal tool for deploying your own site? Possibly not — but that said it is incredibly easy to use as a general CMS and therefore I think makes a great option. There may be more tailored tools for the jobs, but I think the feature set they created for this tool can be applied to create a fantastic, simple portfolio site from scratch extremely quickly. And it looks great!

At the end of the day this was in part a learning exercise for myself to get used to the tool, the experience of which led me to recommend us to use docusaurus to document an internal tool I am working on. But I suggest you yourself go out and examinine and try out other tools as well to make sure you are making the optimal choice for your own use case.
