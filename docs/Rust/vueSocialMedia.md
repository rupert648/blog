---
id: Vue & Rust Social Media Site
---
[Github](https://github.com/fmckeogh/nebula)

**Technologies:** Actix, VueJS, Postgres

<img src="https://rustacean.net/assets/rustacean-flat-gesture.png" alt="drawing" width="200"/>

## About 
Designed and Implemented a Federated Social Media site using the Activity Pub protocol. Created reactive VueJS frontend served by a rust (actix) backend accessing a postgres database.

---
##### Agile Development
My largest experience of agile development to date. This project taught me the importance of incremental development and developing a project with adaptability. I.E. being able to change our development process to meet agile requirements given to us by our scrum manager.

##### Team Development
Working as a team is very different to working alone, particularly on larger scale project. When working at a time it is even more important to compartmentalise your own work. Completing this project to a high standard required strong interpersonal skills as well as being fluent in a range of technologies such as version control to make working together as smooth and efficient as possible.

##### Frontend Design
Expecting a large number of users it was important in this project to think about how a user would be interracting with our site. To maintain a quality user experience it was important to think about UI design. This included decisions including but not limited to; accessability options, colour scheme, icon placement, aesthetics.

##### Backend Design
The key thought process to maintain whilst producing the backend for this project was scalability. Every decision we made was designed to be geared toward that. Our Actix framework was exceptionally fast for a backend but despite this it was important to recognise areas which may slow down our backends response time and analyse the cost-benefit of procedures running on the backend rather than the frontend.

##### Unit Testing
Particularly on the backend, it was important that incorrect, malicious or unidentified requests were handled gracefully. Equally, we needed successful requests to receive requests of the expected format, matching our designed API. Unit testing was an essential part of doing this successfully.

##### Deployment
I developed an understanding on this project of how to setup an environment, to build, test and (if successful) deploy an application to be used on the real world. We used heroku to do this.

##### Database management
We were managing a large database for this project with constant modification. It was important when designing it to consider things like normalisation to ensure atomicity in our database and to minimise the repetition/storage of redundant information.

