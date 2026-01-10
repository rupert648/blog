+++
title = "How a Global HashMap in AWS Lambda Made Our App Speak in Tongues"
date = "2024-12-26"

[taxonomies]
tags = [ "aws-lambda", "graphql", "debugging", "serverless", "i18n", "caching", "war-stories" ]

[extra]
repo_view = true
comment = true
+++



## Background

Before I joined Cloudflare I was working on a GraphQL service aggregating and untangling the spaghetti of data we received from the herd of microservices which kept NowTV (Sky's streaming service in the UK), Peacock (NBCUniversal's streaming platform), and SkyShowtime (a European streaming service) alive. At the time this was an entirely serverless service, built on [AWS lambda serverless](https://aws.amazon.com/lambda/) compute - a decision we would come to regret for a whole host of headaches and footguns, one of which I will try my best to detail in this post. Whilst I'd had some experience delivering some hobby projects onto various serverless compute platforms, this was my first time using them to deliver anything bigger than a university project. I and this team just so happened to be maintaining a not so insignificant service handling upwards of 3 million requests a day, across multiple regions, services and a disturbingly dynamic traffic pattern.

One of the first things you will learn about serverless platforms, is that most (most because [not Cloudflare workers!](https://blog.cloudflare.com/eliminating-cold-starts-with-cloudflare-workers/)) experience something called cold starts. Cold starts occur when a new instance of your Lambda function needs to be initialized from scratch. This happens in a few key scenarios; The most obvious case is when your function hasn't been invoked for a while (and by "a while" I mean as little as 15 minutes in some cases), AWS helpfully decides to tear down your execution environment. The next request that comes in has to wait for the entire container to spin up, your code to be loaded, and any initialization code to run.

But here's where it gets interesting, especially in the JavaScript world - subsequent invocations are lightning fast because the V8 engine keeps your code warm and ready. This is what AWS calls a "warm start", and it's your best friend when dealing with high-traffic services. The execution environment stays alive, your database connections remain established, and any expensive initialization code only needs to run once.

## The Bug Emerges

Around February 2023, one lovely cold British morning in West London various users in the UK reported that their profile page heading texts were coming back in Italian - on our English site. Hmm. Strange, maybe a caching issue in our CDN? It didn't seem to last for long so we moved on. Later that day, we got a message from one of our German SkyShowtime customers, reporting that their account settings page was coming back in Polish - very odd. And by the time a Spanish customer was reporting that their checkout page was in Portuguese (which I'm sure was extremely upsetting), we knew something was afoot.

Immediately like all good engineers we blamed another team. This time it was the content database team, who were responsible for the CMS which returned the various tags, labels and similar page content which we were seeing mistranslated. The desired location and language of those tags were passed from the front end, through our service and forwarded to this CMS service via headers; based on these headers the correct language content was returned. Here's how the request flow should have worked:

{% mermaid() %}
sequenceDiagram
    participant Browser
    participant FrontEnd as Frontend App
    participant Lambda as GraphQL Lambda
    participant CMS as Content CMS

    Browser->>FrontEnd: User visits site
    Note over FrontEnd: Detects user locale
    FrontEnd->>Lambda: GraphQL Query<br/>X-Company-Language: fr-FR
    Lambda->>CMS: GET /content<br/>X-Company-Language: fr-FR
    CMS-->>Lambda: {firstname: "Prénom"}
    Lambda-->>FrontEnd: Return localized content
    FrontEnd-->>Browser: Display in French
{% end %}

 Our delegation efforts were quickly thwarted however, when we hit the production CMS directly and saw that it was consistently returning exactly the content it should be - damn.

So two more points of possible failure:
1. Frontend is somehow sending the wrong language/location headers
2. Our GraphQL Middleware Layer is incorrect

Seeing as it was our job, we investigated our layer - and started where any experienced engineer would at the commits which had been added to the codebase since the last release, after which when the bug began to occur.

This is where we saw the innocuous commit titled something along the lines of "optimised n+1 problem for tag fetching from cms", authored by yours truly.

## The N+1 Problem

If you're not familiar with the N+1 problem, I will give you a very brief explanation specific to GraphQL. Let's say you have a query that asks for a list of checkout pages and their various text tags. Your resolver might look something like this:

```javascript
const resolvers = {
  Query: {
    checkoutPages: () => fetchAllCheckoutPages(),
  },
  CheckoutPage: {
    tags: (page) => fetchTagsForPage(page.id)
  }
}
```

Seems innocent enough right? Well when you query this:

```graphql
query {
  checkoutPages {
    id
    tags {
      text
      language
    }
  }
}
```

What actually happens is your resolver first fetches all the checkout pages (1 query), and then for each page it makes a separate query to fetch its tags (n queries) - hence the term "N+1". So if you have 100 checkout pages, you're suddenly making 101 database calls: the initial query plus one additional query per page.

To solve this, you can "hoist" (that overloaded term again) the +1 calls, in the above example the tags calls, to be all called in one big query in the checkoutPages resolver:

```javascript
interface Page {
  id: string;
  tags: Tag[];
}

interface Tag {
  id: string;
  pageId: string;
  text: string;
  language: string;
}

// Before hoisting - N+1 problem
const resolvers = {
  Query: {
    checkoutPages: () => fetchAllCheckoutPages()
  },
  CheckoutPage: {
    tags: (page) => fetchTagsForPage(page.id)
  }
}

// After hoisting - Single query with tags included
const resolvers = {
  Query: {
    checkoutPages: async () => {
      const pages = await fetchAllCheckoutPages();
      const pageIds = pages.map(page => page.id);
      
      // Fetch ALL tags for ALL pages in one query 
      // (or this could just be combined into one query above)
      const allTags = await fetchTagsForPages(pageIds);
      
      // Return pages with their tags already attached
      return pages.map(page => ({
        ...page,
        tags: allTags.filter(tag => tag.pageId === page.id)
      }));
      // Now GraphQL will automatically resolve the tags field
      // since it's already included in the returned object
    }
  }
}
```

Then we just remove the tags resolver and let our GraphQL lib automatically fill out the values since they already exist in the returning object. Hence we are only making one database call rather than N+1.

However, in our case, we were also resolving a subset of those tags in another part of the schema, with another resolver. Whilst we implemented memoization and caching at our data fetcher layer, meaning identical http calls would save the response and just re-use the value up to a TTL, since we weren't requesting ALL the same tags, the call we were making to the CMS would be different, and therefore would require another roundtrip even though we already had the data saved in another part of the codebase.

Haha... I thought to myself, I have an easy solution, another in-mem cache! We'll just use a hashmap, store each value by its tag name, and boom, before making subsequent calls to the CMS we'll just check this HashMap for the value and return this early. This worked great! I halved the number of calls to this CMS and got a pat on the back. Nice.

However, my mind had been ruined from months of working under the "single request single lifetime" type of programming which some of you might also have been sucked into whilst working in a serverless environment, and so carelessly put this hashmap globally, rather than attaching it to the context of the request. Silly me.

As I said, the cache key into this HashMap was just the label of the content requested from the CMS. But to make life easy, the label was the same between languages, only content differed based on the aforementioned headers. So you can probably see where this was going...

## The Bug

This global hashmap was "surviving" between requests, and this is where AWS Lambda's warm start behavior came back to bite us. Let me break down exactly what was happening:

1. Lambda Instance A spins up (cold start)
   - Global hashmap is initialized (empty)
   - Memory space is allocated just for this instance

2. Request #1 comes in from the UK:
   - Header: `X-Company-Language: en-GB`
   - Looks for "firstname-input-label" in hashmap
   - Not found, fetches from CMS: "First Name"
   - Stores in global hashmap: `{"firstname-input-label": "First Name"}`

3. Request #2 arrives at the *same* Lambda instance:
   - Header: `X-Company-Language: fr-FR`
   - Looks for "firstname-input-label" in hashmap
   - Found! Returns "First Name" instead of fetching "Prénom" from CMS
   - French user sees English text 😱

What made this particularly sneaky was that it would only happen when:
- The Lambda instance was warm (cold starts would reset the hashmap)
- Two requests for the same content in different languages hit the same instance

This created a fascinating pattern where users would see incorrect translations in seemingly random bursts, coinciding with warm Lambda instances serving requests across different regions and languages. The more traffic we had, the more instances were kept warm, and the more likely users were to hit this issue. 

Ironically, our standard monitoring tools didn't catch this initially because they were focused on traditional metrics like error rates and response times - both of which remained perfectly normal. The issue only became apparent through user reports, highlighting a gap in our observability: we weren't monitoring for content correctness across languages.

The fix was easy, instantiate the hashmap on the request context, and, just to be extra safe, include the language in the key.

## The Lessons Learned

The multi-region, multi-language architecture being served by a single Lambda instance turned out to be a fundamental design flaw. While it seemed efficient at first, this approach violated the principle of separation of concerns and created an unnecessary coupling between different locales. A better approach would have been to separate these concerns, perhaps using different Lambda functions for different regions or implementing proper language-based routing.

The specific layout of our GraphQL schema that led to the N+1 problem was another key lesson. While optimizing query performance is important, it's crucial to consider how these optimizations might interact with stateful operations. This highlights the importance of designing schemas with not just performance but also maintainability and isolation in mind.

Our testing strategy had clear gaps - particularly around multi-language scenarios and warm Lambda behavior. Traditional unit tests and integration tests weren't enough to catch this issue. We should have implemented more comprehensive fuzz testing, especially focusing on locale-specific edge cases and state persistence between requests. Furthermore, load testing across different regions with varying language settings could have surfaced this issue before it reached production.

At its core, this bug emerged from forgetting a fundamental principle: serverless functions, despite their persistent warm states, should treat each request as isolated. The "single HTTP call, single function" mentality of serverless made it easy to overlook the implications of global state, but that doesn't excuse me making the silly mistake of violating the stateless nature of HTTP services.

Let it be a lesson to folks. **HTTP IS STATELESS! INCLUDING GRAPHQL!** Don't put anything global, unless you know it can truly be reused between requests.
