---
slug: Deploying a Spring Boot API to Railway using Maven and Docker
title: Deploying a Spring Boot API to Railway using Maven and Docker
authors: [rupert]
tags: [Software, Java, Maven, Railway, Docker, Springboot, Spring-boot, Backend]
---

In this guide we will walk through how to deploy a Java Spring Boot API to railway.app , its deceptively simple to do, and with railway’s use of nixpacks the speed of deployment will blow your mind.

This deployment takes just 5 steps to get from no-code to your very own public API service.

1. Create a Springboot application and define some routes

1. Push this application to a github repo.

1. Create a project on Railway.app from this github repo.

1. Create a dockerfile to build and package the application and push it to the repo

1. Expose a public domain on Railway.app

## Getting Started

### The Springboot Application

The first thing you will need is a spring boot API that you can deploy! If you are just getting started with this, you can follow the official [SpringBoot Getting Started Guide](https://spring.io/guides/gs/spring-boot/) to get your first project up and running.

My directory structure with a project titled “getyourway” looks as follows.

![](https://cdn-images-1.medium.com/max/2000/1*m7dGC5a-wLzotnPx3g-xVQ.png)

I created a file titled HelloController.java and put in the following code to define one route to `/`

```java
@RestController
public class HelloController {

	@GetMapping("/")
	public String index() {
		return "Hello World!";
	}

}
```

If we run the application using $ mvn spring-boot:run we can navigate to http://localhost:8080/hello where we can see our response.

Once done, be sure to **push this project to your own github repository,** so that we can later integrate with railway.

### Railway

To integrate this project with railway you will need to do two things.

* Create a Railway.app account

* Connect Railway.app to your github account

Railway will walk you through signing up. Once done, railway will greet you with this page.

![](https://cdn-images-1.medium.com/max/3798/1*J1QYzBKAKiTNdK-kGjxWWg.png)

From here we will click **Start a New Project **and then ***Deploy from a Github Repo.***

From this next screen, this is where we can connect and configure railway to work with our github account. So go ahead and click **Configure Github App**.

This will first ask you to add the app to your github account, then will allow you to configure the account and its permissions.

![](https://cdn-images-1.medium.com/max/2000/1*0Pg4uVoMfq7yLXO2i-wQwg.png)

Repository access will allow you to choose which repositories Railway can see. I chose to only select certain repositories, in which case **you must select your newly created springboot repository so we can access it.**

Now this is configured, back on Railway we can go ahead and select our github repository. Next click the **Add Variables** option, rather than deploying it right away — we first need to setup our repo to deploy.

## Configuring SpringBoot to Deploy using Maven

The docker file for our application involves two stages to the docker file.

1. Building the jar file

1. Packaging the application

### The Dockerfile

In the root directory, create a Dockerfile with the following content

```Dockerfile
#
# Build stage
#
FROM maven:3.6.0-jdk-11-slim AS build
COPY src /home/app/src
COPY pom.xml /home/app
RUN mvn -f /home/app/pom.xml clean package

#
# Package stage
#
FROM openjdk:11-jre-slim
COPY --from=build /home/app/target/getyourway-0.0.1-SNAPSHOT.jar /usr/local/lib/demo.jar
EXPOSE 8080
ENTRYPOINT ["java","-jar","/usr/local/lib/demo.jar"]
```

**NOTE: **Be sure to change maven and openjdk to use the version of java you are using and generated the spring-boot application with to prevent build errors.

The build stage uses mvn package to create a jar file of our application from our pom.xml

The package stage then exposes a port before defining an entrypoint for our package. Don’t forget to change /home/app/target/getyourway-0.0.1-SNAPSHOT.jar to match the name of your application (just the jar filename needs adjusting)

We expose port 8080, the default launch port for springboot, if you have modified this value at all in the config for your springboot application, change the port value here.

### Expose port on Railway

Before we redeploy, we must let railway know which port our application should listen on. This can be done by setting the environment variable PORT in railway, as can be seen in the image below. Again this should be set to 8080 or your corresponding port.

![](https://cdn-images-1.medium.com/max/2330/1*IM_Qm9PqZfk_3mN7FCQkhA.png)

Now this is done, **push your code **to the github repository.

Immediately Railway will spot this new push and start to redeploy this service.

Amazingly — thats it! Railway will immediately **identify the Dockerfile** in your repository, and use it to build an image which it uses to run the service.

## Making it public

If we now go to the settings page of our Railway application we can click the **Generate Domain** button underneath ***Domains ***(or alternatively add your own domain), this will take a few seconds or minutes but then once your service has adjusted, follow through to this generated domain and go to [https://your-generated-project-name.up.railway.app/](https://getyourway-production.up.railway.app/) and you should see “Hello World!” as your result!
