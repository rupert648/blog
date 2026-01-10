+++
title = "Dynamically Scaling a Workflow Step in Argo Workflows"
date = "2022-11-05"

[taxonomies]
tags = ["Kubernetes", "Argo", "Argo Workflows"]

[extra]
repo_view = true
comment = true
+++

# What is Argo

From the Argo Site:
> Argo Workflows is an open source container-native workflow engine for orchestrating parallel jobs on Kubernetes

Argo workflows allows you to define through a configuration file a series of steps to run inside a kubernetes cluster. Argo from this configuration will control the sequencing for this as well as orchestrating any parallel operations you define.

When managing many parallel running workflows, argo does all the leg work for you. It will spin up containers to handle the steps you define using the kubernetes API. However this wasn't what I wanted.

The use case I wanted to achieve for was to dynamically scale a ***single*** ***step*** in a workflow, whilst keeping other steps static.

# Why did I need this Use Case?

A simplification of my use case provided just two steps:

1. A data generation step, which puts the data into a shared database
2. A data pulling step, which pulls the data from the database and performs some processing on the data, before dumping it to a storage solution.

I wanted the data being generated in the first stage to consistently be unique whilst running the node. There are fancy ways to do this whilst running multiple containers but the simplest way to ensure unique data is to just have a single node generating the data.

The second step is what I wanted to scale — I want to make a decision based upon how much data is generated from the first step to decide how many instances of the second step I created. This would allow me to process the data in parallel. This would make the data processing step much quicker.

*Note: A better solution to this issue might be to extract the data production from the workflow, however keeping it inside the workflow itself allowed expandability within my use case as well as the ability to extremely easily orchestrate the whole thing on a CRON job.*

# Installation

To preface the solution, to demo these steps I am running these steps in a local cluster using [Minikube](https://minikube.sigs.k8s.io/docs/start/). To install minikube follow the instructions on their site, or using homebrew:

```bash
brew install minikube
```

Run minikube start to spin up your minikube instance, then run the following to install argo:

```bash
kubectl create namespace argo
kubectl apply -n argo -f https://github.com/argoproj/argo-workflows/releases/download/v<<ARGO_WORKFLOWS_VERSION>>/install.yaml
```

For the writing of this tutorial, I am using **v3.4.2**

You will also need to install the [Argo CLI](https://github.com/argoproj/argo-workflows/releases/tag/v3.4.3)

# The Solution

The solution to this problem I found was to utilise the output parameters you are able to pass through the steps in Argo Workflows. We can use these in conjunction with the withParam attribute to run parallel jobs.

## Output Parameters

Argo provides several forms of functionality for passing output parameters between steps:

* Reading the standard output of a container/script
* Taking the value from a specified file

Reading the standard output is okay for simple scripts, however since many programs will involve regular std output such as logging this may conflict and cause issues, hence creating a temp file to write the value is the easier route. Argo provides in their docs an example on how to do this:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: output-parameter-
spec:
  entrypoint: output-parameter
  templates:
  - name: output-parameter
    steps:
    - - name: generate-parameter
        template: whalesay
    - - name: consume-parameter
        template: print-message
        arguments:
          parameters:
          - name: message
            value: "{{steps.generate-parameter.outputs.parameters.hello-param}}"

  - name: whalesay
    container:
      image: docker/whalesay:latest
      command: [sh, -c]
      args: ["sleep 1; echo -n hello world > /tmp/hello_world.txt"]
    outputs:
      parameters:
      - name: hello-param
        valueFrom:
          default: "Foobar"   # Default value to use if retrieving valueFrom fails
          path: /tmp/hello_world.txt

  - name: print-message
    inputs:
      parameters:
      - name: message
    container:
      image: docker/whalesay:latest
      command: [cowsay]
      args: ["{{inputs.parameters.message}}"]
```

We can see that the first step in this workflow writes the value "hello world" to a file /tmp/hello_world.txt, then argo grabs the value written to the file as a parameter called *hello-world*. Then we use `{{steps.generate-parameter.outputs.parameters.hello-param}}` to access that parameter in the next step, which uses whalesay to print out the parameter.

We can submit this workflow using the following command:

```bash
argo submit -n argo --watch output-parameter-workflow.yaml
```

This will give the following output in the terminal:

![Terminal Output](https://cdn-images-1.medium.com/max/3200/1*U_VL3AlVeLLL1vE6DYBw9g.png)

We can view the logs for this workflow to verify the paramater was successfully passed between steps using:

```bash
argo logs -n argo @latest
```

![Log Output](https://cdn-images-1.medium.com/max/5120/1*ebc7yTtVAgWBpyhSGvSeNw.png)

## The withParam attribute

We can use these output parameters to define the number of the following steps using the withParam attribute.

The withParam attribute takes a JSON list as input, and will run the steps in parallel for each value in the list.

We can use this to our advantage by creating this json list in the previous step, and then using it in the withParam attribute. A simple example of doing this might look as follows:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Workflow
metadata:
  generateName: loops-param-result-
spec:
  entrypoint: loop-param-result-example
  templates:
  - name: loop-param-result-example
    steps:
    - - name: generate
        template: gen-number-list
    - - name: sleep
        template: sleep-n-sec
        arguments:
          parameters:
          - name: seconds
            value: "{{item}}"
        withParam: "{{steps.generate.outputs.result}}"

  - name: gen-number-list
    script:
      image: python:alpine3.6
      command: [python]
      source: |
        import json
        import sys
        json.dump([i for i in range(20, 31)], sys.stdout)
  - name: sleep-n-sec
    inputs:
      parameters:
      - name: seconds
    container:
      image: alpine:latest
      command: [sh, -c]
      args: ["echo sleeping for {{inputs.parameters.seconds}} seconds; sleep {{inputs.parameters.seconds}}; echo done"]
```

[Rest of blog post continues with all code blocks, images, and formatting preserved...]

# Conclusion

So there we go, a way to dynamically scale a step in an Argo Workflow. I would think carefully before deciding if this is something you need, but if you do I think its a neat solution to the problem which takes advantage of configuration attributes available.
